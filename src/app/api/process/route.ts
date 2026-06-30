// PDF 处理 API — 接收 PDF 文件，返回提取的表格数据和 Excel 下载链接
import { NextResponse } from "next/server";
import { extractTablesFromPDF } from "@/lib/pdf-utils";
import { recordDownload } from "@/lib/supabase";
import * as XLSX from "xlsx";

// 限制文件大小为 5MB（Vercel 免费版 Serverless 有 4.5MB 请求体限制）
const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4MB

export async function POST(request: Request) {
  try {
    // 解析上传的文件
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "请上传一个 PDF 文件" },
        { status: 400 }
      );
    }

    // 验证文件类型
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json(
        { error: "仅支持 PDF 文件格式" },
        { status: 400 }
      );
    }

    // 验证文件大小
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "文件大小不能超过 4MB，请压缩后重试" },
        { status: 400 }
      );
    }

    // 将文件转为 Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 提取表格
    const tables = await extractTablesFromPDF(buffer);

    if (tables.length === 0) {
      return NextResponse.json({
        success: false,
        message: "未在 PDF 中检测到表格数据。请确认 PDF 包含可提取的表格（非扫描件）。",
        tables: [],
        excelDownloadUrl: null,
      });
    }

    // 生成 Excel 文件
    const excelBuffer = generateExcel(tables, file.name);

    // 记录下载（如果 Supabase 已配置）
    const pageCount = tables.length > 0 ? 1 : 0; // 简化：用表格数估算
    recordDownload(file.name, pageCount, tables.length).catch(() => {});

    // 返回 Excel（base64 编码，前端可直接下载）
    const excelBase64 = excelBuffer.toString("base64");

    return NextResponse.json({
      success: true,
      tables,
      excelData: excelBase64,
      excelFilename: file.name.replace(/\.pdf$/i, "") + "_提取结果.xlsx",
    });
  } catch (error) {
    console.error("PDF 处理失败:", error);
    return NextResponse.json(
      {
        error:
          "PDF 处理失败，请确认文件未损坏且非扫描版 PDF。" +
          (error instanceof Error ? ` 错误详情：${error.message}` : ""),
      },
      { status: 500 }
    );
  }
}

/**
 * 将提取的表格生成 Excel Workbook
 */
function generateExcel(
  tables: { title?: string; headers: string[]; rows: string[][] }[],
  originalFilename: string
): Buffer {
  const workbook = XLSX.utils.book_new();

  if (tables.length === 1) {
    // 单个表格：直接放在第一个 sheet
    const sheetData = [tables[0].headers, ...tables[0].rows];
    const sheet = XLSX.utils.aoa_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");
  } else {
    // 多个表格：每个表格一个 sheet
    for (let i = 0; i < tables.length; i++) {
      const t = tables[i];
      const sheetData = [t.headers, ...t.rows];
      const sheet = XLSX.utils.aoa_to_sheet(sheetData);
      const sheetName =
        t.title?.slice(0, 31) || `表格${i + 1}`;
      // Excel sheet 名不能超过 31 个字符
      const safeName = sheetName.replace(/[\\\/\*\?\[\]:]/g, "-").slice(0, 31);
      XLSX.utils.book_append_sheet(workbook, sheet, safeName);
    }
  }

  // 设置元数据
  workbook.Props = {
    Title: `PDF表格提取 - ${originalFilename}`,
    CreatedDate: new Date(),
  };

  return Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));
}
