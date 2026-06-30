"use client";

import { useState, useCallback, useRef } from "react";
import { extractTablesFromPDF, type ExtractedTable } from "@/lib/pdf-utils";
import * as XLSX from "xlsx";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExtractedTable[] | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (f: File) => {
    if (!f.name.toLowerCase().endsWith(".pdf")) {
      setError("仅支持 PDF 文件格式");
      setFile(null);
      return;
    }

    setFile(f);
    setError(null);
    setResult(null);
    setLoading(true);

    try {
      const arrayBuffer = await f.arrayBuffer();
      const tables = await extractTablesFromPDF(arrayBuffer);

      if (tables.length === 0) {
        setError(
          "未在 PDF 中检测到表格数据。请确认 PDF 包含可提取的表格（非扫描版图片 PDF）。"
        );
      } else {
        setResult(tables);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "未知错误";
      setError(`PDF 处理失败：${msg}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const downloadExcel = useCallback(() => {
    if (!result) return;
    const buffer = generateExcel(result, file?.name ?? "document.pdf");
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (file?.name ?? "document").replace(/\.pdf$/i, "") + "_提取结果.xlsx";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [result, file]);

  return (
    <div className="flex flex-col flex-1">
      {/* Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="font-bold text-lg">PDF → Excel</span>
          <span className="text-sm text-zinc-500">
            纯浏览器处理 · 文件不上传 · 安全隐私
          </span>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8">
        {/* Hero */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold tracking-tight mb-3">
            PDF 表格一键导出 Excel
          </h1>
          <p className="text-lg text-zinc-500 max-w-lg mx-auto">
            所有处理在你的浏览器内完成，文件不会上传到任何服务器。
          </p>
        </div>

        {/* Upload */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all
            ${dragOver ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30" : "border-zinc-300 dark:border-zinc-600 hover:border-zinc-400"}
            ${loading ? "pointer-events-none opacity-60" : ""}`}
        >
          <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

          {loading ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-zinc-300 border-t-blue-500 rounded-full animate-spin" />
              <p className="text-zinc-500">正在提取表格数据…</p>
            </div>
          ) : file ? (
            <div className="flex flex-col items-center gap-2">
              <span className="text-4xl">📄</span>
              <p className="font-medium">{file.name}</p>
              <p className="text-sm text-zinc-400">{(file.size / 1024).toFixed(0)} KB · 点击更换文件</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <span className="text-5xl">📁</span>
              <p className="font-medium text-zinc-600 dark:text-zinc-300">拖拽 PDF 到此处，或点击上传</p>
              <p className="text-sm text-zinc-400">银行对账单 · 发票 · 财务报表 · 表格类 PDF</p>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mt-6 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="mt-8 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg">
                提取结果 · {result.length} 个表格
              </h2>
              <button onClick={downloadExcel}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white font-medium rounded-xl hover:bg-green-700 transition-colors">
                ⬇ 下载 Excel
              </button>
            </div>

            {result.map((table, idx) => (
              <div key={idx} className="border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden">
                {table.title && (
                  <div className="px-4 py-2 bg-zinc-50 dark:bg-zinc-800 text-sm font-medium text-zinc-500">
                    {table.title}
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-zinc-100 dark:bg-zinc-800">
                        {table.headers.map((h, i) => (
                          <th key={i} className="px-4 py-2 text-left font-medium whitespace-nowrap">{h || `列${i + 1}`}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {table.rows.slice(0, 20).map((row, ri) => (
                        <tr key={ri} className="border-t border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                          {row.map((cell, ci) => (
                            <td key={ci} className="px-4 py-1.5 whitespace-nowrap max-w-[200px] truncate">{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {table.rows.length > 20 && (
                  <div className="px-4 py-2 text-xs text-zinc-400 bg-zinc-50 dark:bg-zinc-800">
                    仅显示前 20 行 · 共 {table.rows.length} 行
                  </div>
                )}
                <div className="px-4 py-1.5 text-xs text-zinc-400 bg-zinc-50 dark:bg-zinc-800 border-t border-zinc-100 dark:border-zinc-800">
                  提取置信度：{(table.confidence * 100).toFixed(0)}%
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Features */}
        {!result && (
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { emoji: "🔒", title: "隐私安全", desc: "纯浏览器处理，文件不上传服务器" },
              { emoji: "⚡", title: "秒级处理", desc: "本地运算，无需等待网络传输" },
              { emoji: "📊", title: "Excel 导出", desc: "提取结果直接下载 .xlsx 格式" },
            ].map((f) => (
              <div key={f.title} className="text-center p-6 rounded-xl border border-zinc-100 dark:border-zinc-800">
                <span className="text-3xl">{f.emoji}</span>
                <h3 className="font-medium mt-2">{f.title}</h3>
                <p className="text-sm text-zinc-400 mt-1">{f.desc}</p>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-zinc-100 dark:border-zinc-800 py-6 text-center text-sm text-zinc-400">
        PDF 转 Excel · 纯浏览器处理 · 文件不上传 · 安全免费
      </footer>
    </div>
  );
}

function generateExcel(
  tables: ExtractedTable[],
  originalFilename: string
): ArrayBuffer {
  const workbook = XLSX.utils.book_new();

  if (tables.length === 1) {
    const sheetData = [tables[0].headers, ...tables[0].rows];
    const sheet = XLSX.utils.aoa_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");
  } else {
    for (let i = 0; i < tables.length; i++) {
      const t = tables[i];
      const sheetData = [t.headers, ...t.rows];
      const sheet = XLSX.utils.aoa_to_sheet(sheetData);
      const name = (t.title?.slice(0, 31) || `Table${i + 1}`).replace(
        /[\\\/\*\?\[\]:]/g,
        "-"
      );
      XLSX.utils.book_append_sheet(workbook, sheet, name.slice(0, 31));
    }
  }

  workbook.Props = {
    Title: `PDF Table Export - ${originalFilename}`,
    CreatedDate: new Date(),
  };

  const dataArray = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  return new Uint8Array(dataArray).buffer as ArrayBuffer;
}
