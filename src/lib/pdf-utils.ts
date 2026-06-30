// PDF 表格提取工具
// 支持银行对账单、发票等结构化 PDF 的表格数据提取

import pdfParse from "pdf-parse";

export interface ExtractedTable {
  /** 表头 */
  headers: string[];
  /** 数据行 */
  rows: string[][];
  /** 表格上方可能存在的标题文字 */
  title?: string;
  /** 提取置信度 0-1 */
  confidence: number;
}

interface TextBlock {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 从 PDF Buffer 中提取所有表格
 */
export async function extractTablesFromPDF(
  buffer: Buffer
): Promise<ExtractedTable[]> {
  const data = await pdfParse(buffer, {
    // 禁用渲染以加速（我们只需要文本内容）
    pagerender: undefined,
  });

  const text = data.text;
  if (!text || text.trim().length === 0) {
    return [];
  }

  // 按页分割文本
  const pages = splitIntoPages(text);
  const allTables: ExtractedTable[] = [];

  for (const page of pages) {
    const tables = extractTablesFromText(page);
    allTables.push(...tables);
  }

  return allTables;
}

/**
 * 按页分割 PDF 文本
 * pdf-parse 在页面之间插入换页标记
 */
function splitIntoPages(text: string): string[] {
  // pdf-parse 默认在页面间插入 \n\n（两个换行）
  // 先按明显的分页标记分
  const pages = text.split(/\f|\n{3,}/);
  return pages.filter((p) => p.trim().length > 0);
}

/**
 * 从纯文本中检测并提取表格
 */
function extractTablesFromText(text: string): ExtractedTable[] {
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const tables: ExtractedTable[] = [];
  let currentTableLines: string[] = [];
  let tableTitle: string | undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 判断这一行是否是表格行（包含多个由空格/tab分隔的列）
    const columns = splitIntoColumns(line);

    if (columns.length >= 2 && looksLikeTableRow(columns)) {
      // 表格行：加入当前表格
      if (currentTableLines.length === 0 && i > 0) {
        // 检查上一行是不是表格标题
        const prevLine = lines[i - 1].trim();
        if (
          prevLine.length < 60 &&
          !looksLikeTableRow(splitIntoColumns(prevLine))
        ) {
          tableTitle = prevLine;
        }
      }
      currentTableLines.push(line);
    } else {
      // 非表格行：如果积累了一些表格行，尝试解析
      if (currentTableLines.length >= 2) {
        const table = parseTable(currentTableLines, tableTitle);
        if (table) {
          tables.push(table);
        }
      }
      currentTableLines = [];
      tableTitle = undefined;
    }
  }

  // 处理最后一组
  if (currentTableLines.length >= 2) {
    const table = parseTable(currentTableLines, tableTitle);
    if (table) {
      tables.push(table);
    }
  }

  return tables;
}

/**
 * 按多空格 / Tab 分割文本为列
 */
function splitIntoColumns(line: string): string[] {
  // 先尝试按 2 个及以上空格分割
  const bySpaces = line.split(/\s{2,}/);
  if (bySpaces.length >= 2) {
    return bySpaces.map((s) => s.trim()).filter((s) => s.length > 0);
  }

  // 再尝试按 Tab 分割
  const byTabs = line.split("\t");
  if (byTabs.length >= 2) {
    return byTabs.map((s) => s.trim()).filter((s) => s.length > 0);
  }

  return [line.trim()];
}

/**
 * 判断一组列是否看起来像表格行（不是普通文本）
 */
function looksLikeTableRow(columns: string[]): boolean {
  if (columns.length < 2) return false;

  // 至少有一列看起来像数据（数字、日期、金额）
  const hasDataColumn = columns.some(isDataLike);
  if (hasDataColumn) return true;

  // 或者多列长度相近（固定宽度列）
  const lengths = columns.map((c) => c.length);
  const avgLen = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  if (avgLen > 3 && avgLen < 40) return true;

  return false;
}

/**
 * 判断字符串是否像数据（数字、金额、日期等）
 */
function isDataLike(str: string): boolean {
  const s = str.trim();
  // 纯数字
  if (/^\d+$/.test(s)) return true;
  // 带小数点的数字
  if (/^\d+\.\d+$/.test(s)) return true;
  // 金额（带逗号分隔）
  if (/^[\d,]+\.\d{2}$/.test(s)) return true;
  // 金额带货币符号
  if (/^[¥$€£]\s*[\d,]+\.?\d*$/.test(s)) return true;
  if (/^[\d,]+\.?\d*\s*[¥$€£]$/i.test(s)) return true;
  // 日期
  if (/^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}$/.test(s)) return true;
  // 百分比
  if (/^-?\d+\.?\d*\s*%$/.test(s)) return true;
  return false;
}

/**
 * 解析表格：推断表头和数据行
 */
function parseTable(
  lines: string[],
  title?: string
): ExtractedTable | null {
  if (lines.length < 2) return null;

  const parsedLines = lines.map((line) => splitIntoColumns(line));

  // 确定列数（取众数）
  const colCounts = parsedLines.map((cols) => cols.length);
  const colCount = mode(colCounts);
  if (colCount < 2) return null;

  // 过滤掉列数不匹配的行
  const aligned = parsedLines.filter(
    (cols) => cols.length >= colCount - 1 && cols.length <= colCount + 1
  );
  if (aligned.length < 2) return null;

  // 标准化列数
  const normalized = aligned.map((cols) => {
    while (cols.length < colCount) cols.push("");
    return cols.slice(0, colCount);
  });

  // 判断第一行是不是表头
  const hasHeader = normalized[0].some(
    (c) => !isDataLike(c) && c.length > 0 && c.length < 30
  );

  if (hasHeader) {
    return {
      title,
      headers: normalized[0],
      rows: normalized.slice(1),
      confidence: calculateConfidence(normalized[0], normalized.slice(1)),
    };
  }

  // 没有表头，自动生成
  return {
    title,
    headers: normalized[0].map((_, i) => `列${i + 1}`),
    rows: normalized,
    confidence: calculateConfidence([], normalized),
  };
}

/**
 * 计算提取置信度
 */
function calculateConfidence(
  headers: string[],
  rows: string[][]
): number {
  let score = 0.5;

  // 表头非空加分
  if (headers.some((h) => h.length > 1 && !isDataLike(h))) score += 0.15;

  // 数据行中有数值列加分
  const dataColumns = rows[0]?.filter(isDataLike).length ?? 0;
  if (dataColumns > 0) score += 0.15;

  // 多行数据加分
  if (rows.length >= 3) score += 0.1;
  if (rows.length >= 10) score += 0.1;

  return Math.min(score, 1.0);
}

/**
 * 数组众数
 */
function mode(arr: number[]): number {
  const counts = new Map<number, number>();
  for (const n of arr) {
    counts.set(n, (counts.get(n) ?? 0) + 1);
  }
  let maxCount = 0;
  let maxVal = arr[0];
  for (const [val, count] of counts) {
    if (count > maxCount) {
      maxCount = count;
      maxVal = val;
    }
  }
  return maxVal;
}
