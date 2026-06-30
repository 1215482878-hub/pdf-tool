// 纯客户端 PDF 表格提取 — pdfjs-dist 仅在浏览器中动态加载
// 不要在顶层 import pdfjs-dist，否则 SSR/build 时会在 Node.js 环境报错

export interface ExtractedTable {
  headers: string[];
  rows: string[][];
  title?: string;
  confidence: number;
}

/**
 * 从 PDF ArrayBuffer 中提取所有表格
 * pdfjs-dist 在函数内动态导入，确保只在浏览器端运行
 */
export async function extractTablesFromPDF(
  arrayBuffer: ArrayBuffer
): Promise<ExtractedTable[]> {
  const pdfjsLib = await import("pdfjs-dist");

  // 使用本地 worker 文件，不依赖外网 CDN
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    typeof window !== "undefined"
      ? window.location.origin + "/pdf-tool/pdf.worker.min.mjs"
      : "/pdf-tool/pdf.worker.min.mjs";

  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const allTables: ExtractedTable[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawItems = textContent.items as any[];
    const items = rawItems
      .filter((item) => "str" in item && "transform" in item)
      .map((item) => ({
        text: item.str as string,
        x: item.transform[4] as number,
        y: item.transform[5] as number,
        width: item.width as number,
        height: item.height as number,
      }));

    const rows = groupTextItemsByRow(items);
    const text = rows.map((row) => row.map((item) => item.text).join(" "));

    const tables = extractTablesFromLines(text);
    allTables.push(...tables);
  }

  return allTables;
}

// ---- 以下为纯算法，不依赖任何外部库 ----

interface TextItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

function groupTextItemsByRow(items: TextItem[]): TextItem[][] {
  if (items.length === 0) return [];

  const sorted = [...items].sort((a, b) => a.y - b.y);

  const rows: TextItem[][] = [];
  let currentRow: TextItem[] = [sorted[0]];
  let currentY = sorted[0].y;

  for (let i = 1; i < sorted.length; i++) {
    const item = sorted[i];
    if (Math.abs(item.y - currentY) < 5) {
      currentRow.push(item);
    } else {
      currentRow.sort((a, b) => a.x - b.x);
      rows.push(currentRow);
      currentRow = [item];
      currentY = item.y;
    }
  }

  currentRow.sort((a, b) => a.x - b.x);
  rows.push(currentRow);
  return rows;
}

function extractTablesFromLines(lines: string[]): ExtractedTable[] {
  if (lines.length < 2) return [];

  const tables: ExtractedTable[] = [];
  let currentTableLines: string[] = [];
  let tableTitle: string | undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const columns = splitIntoColumns(line);

    if (columns.length >= 2 && looksLikeTableRow(columns)) {
      if (currentTableLines.length === 0 && i > 0) {
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
      if (currentTableLines.length >= 2) {
        const table = parseTable(currentTableLines, tableTitle);
        if (table) tables.push(table);
      }
      currentTableLines = [];
      tableTitle = undefined;
    }
  }

  if (currentTableLines.length >= 2) {
    const table = parseTable(currentTableLines, tableTitle);
    if (table) tables.push(table);
  }

  return tables;
}

function splitIntoColumns(line: string): string[] {
  const bySpaces = line.split(/\s{2,}/);
  if (bySpaces.length >= 2)
    return bySpaces.map((s) => s.trim()).filter((s) => s.length > 0);
  const byTabs = line.split("\t");
  if (byTabs.length >= 2)
    return byTabs.map((s) => s.trim()).filter((s) => s.length > 0);
  return [line.trim()];
}

function looksLikeTableRow(columns: string[]): boolean {
  if (columns.length < 2) return false;
  if (columns.some(isDataLike)) return true;
  const lengths = columns.map((c) => c.length);
  const avgLen = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  return avgLen > 3 && avgLen < 40;
}

function isDataLike(str: string): boolean {
  const s = str.trim();
  if (/^\d+$/.test(s)) return true;
  if (/^\d+\.\d+$/.test(s)) return true;
  if (/^[\d,]+\.\d{2}$/.test(s)) return true;
  if (/^[¥$€£]\s*[\d,]+\.?\d*$/.test(s)) return true;
  if (/^[\d,]+\.?\d*\s*[¥$€£]$/i.test(s)) return true;
  if (/^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}$/.test(s)) return true;
  if (/^-?\d+\.?\d*\s*%$/.test(s)) return true;
  return false;
}

function parseTable(
  lines: string[],
  title?: string
): ExtractedTable | null {
  if (lines.length < 2) return null;

  const parsedLines = lines.map((line) => splitIntoColumns(line));
  const colCounts = parsedLines.map((cols) => cols.length);
  const colCount = mode(colCounts);
  if (colCount < 2) return null;

  const aligned = parsedLines.filter(
    (cols) => cols.length >= colCount - 1 && cols.length <= colCount + 1
  );
  if (aligned.length < 2) return null;

  const normalized = aligned.map((cols) => {
    while (cols.length < colCount) cols.push("");
    return cols.slice(0, colCount);
  });

  const hasHeader = normalized[0].some(
    (c) => !isDataLike(c) && c.length > 0 && c.length < 30
  );

  if (hasHeader) {
    return {
      title,
      headers: normalized[0],
      rows: normalized.slice(1),
      confidence: calcConfidence(normalized[0], normalized.slice(1)),
    };
  }

  return {
    title,
    headers: normalized[0].map((_, i) => `列${i + 1}`),
    rows: normalized,
    confidence: calcConfidence([], normalized),
  };
}

function calcConfidence(headers: string[], rows: string[][]): number {
  let score = 0.5;
  if (headers.some((h) => h.length > 1 && !isDataLike(h))) score += 0.15;
  const dataCols = rows[0]?.filter(isDataLike).length ?? 0;
  if (dataCols > 0) score += 0.15;
  if (rows.length >= 3) score += 0.1;
  if (rows.length >= 10) score += 0.1;
  return Math.min(score, 1.0);
}

function mode(arr: number[]): number {
  const counts = new Map<number, number>();
  for (const n of arr) counts.set(n, (counts.get(n) ?? 0) + 1);
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
