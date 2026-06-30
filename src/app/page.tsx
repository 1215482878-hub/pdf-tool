"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { extractTablesFromPDF, type ExtractedTable } from "@/lib/pdf-utils";
import {
  canUse,
  recordUsage,
  remainingFree,
  getLicense,
  activateLicense,
  generateActivationCode,
} from "@/lib/license";
import * as XLSX from "xlsx";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExtractedTable[] | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [freeLeft, setFreeLeft] = useState(3);
  const [activated, setActivated] = useState(false);
  const [showActivate, setShowActivate] = useState(false);
  const [actCode, setActCode] = useState("");
  const [actMsg, setActMsg] = useState("");
  const [actStatus, setActStatus] = useState<"" | "success" | "error">("");
  const [paidCode, setPaidCode] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 初始化许可证状态
  useEffect(() => {
    const lic = getLicense();
    setActivated(lic.activated);
    setFreeLeft(remainingFree());
  }, []);

  const handleFile = useCallback(
    async (f: File) => {
      if (!f.name.toLowerCase().endsWith(".pdf")) {
        setError("仅支持 PDF 文件格式");
        setFile(null);
        return;
      }

      // 检查使用次数
      if (!canUse()) {
        setError(
          "今日免费次数已用完（3次/天）。请升级永久版解锁无限使用。"
        );
        setShowActivate(true);
        setFile(null);
        return;
      }

      setFile(f);
      setError(null);
      setResult(null);
      setLoading(true);
      recordUsage();
      setFreeLeft(remainingFree());

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
    },
    []
  );

  const downloadExcel = useCallback(() => {
    if (!result) return;
    const buffer = generateExcel(
      result,
      file?.name ?? "document.pdf",
      !activated // 未激活加水印
    );
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download =
      (file?.name ?? "document").replace(/\.pdf$/i, "") + "_提取结果.xlsx";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [result, file, activated]);

  const handlePaid = useCallback(() => {
    const code = generateActivationCode();
    setPaidCode(code);
  }, []);

  const handleActivate = useCallback(() => {
    const result = activateLicense(actCode);
    if (result.success) {
      setActMsg(result.message);
      setActStatus("success");
      setActivated(true);
      setTimeout(() => setShowActivate(false), 1500);
    } else {
      setActMsg(result.message);
      setActStatus("error");
    }
  }, [actCode]);

  return (
    <div className="flex flex-col flex-1">
      {/* Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="font-bold text-lg">PDF → Excel</span>
          <div className="flex items-center gap-4 text-sm">
            {activated ? (
              <span className="text-green-600 font-medium">🔓 永久版</span>
            ) : (
              <>
                <span className="text-zinc-500">
                  今日剩余：{freeLeft === Infinity ? "无限" : `${freeLeft} 次`}
                </span>
                <button
                  onClick={() => {
                    setShowActivate(true);
                    setActCode("");
                    setActMsg("");
                    setActStatus("");
                  }}
                  className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700"
                >
                  升级永久版
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8">
        {/* Hero */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold tracking-tight mb-3">
            PDF 表格一键导出 Excel
          </h1>
          <p className="text-lg text-zinc-500 max-w-lg mx-auto">
            纯浏览器处理，文件不上传任何服务器。
          </p>
        </div>

        {/* Upload */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files[0];
            if (f) handleFile(f);
          }}
          onClick={() => {
            if (!canUse() && !activated) {
              setShowActivate(true);
              return;
            }
            fileInputRef.current?.click();
          }}
          className={`relative border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all
            ${
              dragOver
                ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                : "border-zinc-300 dark:border-zinc-600 hover:border-zinc-400"
            }
            ${loading ? "pointer-events-none opacity-60" : ""}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />

          {loading ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-zinc-300 border-t-blue-500 rounded-full animate-spin" />
              <p className="text-zinc-500">正在提取表格数据…</p>
            </div>
          ) : file ? (
            <div className="flex flex-col items-center gap-2">
              <span className="text-4xl">📄</span>
              <p className="font-medium">{file.name}</p>
              <p className="text-sm text-zinc-400">
                {(file.size / 1024).toFixed(0)} KB · 点击更换文件
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <span className="text-5xl">📁</span>
              <p className="font-medium text-zinc-600 dark:text-zinc-300">
                拖拽 PDF 到此处，或点击上传
              </p>
              <p className="text-sm text-zinc-400">
                银行对账单 · 发票 · 财务报表 · 表格类 PDF
              </p>
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
                {!activated && (
                  <span className="text-xs text-amber-600 ml-2 font-normal">
                    （试用版 · Excel 含水印）
                  </span>
                )}
              </h2>
              <button
                onClick={downloadExcel}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white font-medium rounded-xl hover:bg-green-700 transition-colors"
              >
                ⬇ 下载 Excel
              </button>
            </div>

            {result.map((table, idx) => (
              <div
                key={idx}
                className="border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden"
              >
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
                          <th
                            key={i}
                            className="px-4 py-2 text-left font-medium whitespace-nowrap"
                          >
                            {h || `列${i + 1}`}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {table.rows.slice(0, 20).map((row, ri) => (
                        <tr
                          key={ri}
                          className="border-t border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                        >
                          {row.map((cell, ci) => (
                            <td
                              key={ci}
                              className="px-4 py-1.5 whitespace-nowrap max-w-[200px] truncate"
                            >
                              {cell}
                            </td>
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
              </div>
            ))}
          </div>
        )}

        {/* Pricing card */}
        {!activated && !result && (
          <div className="mt-12 max-w-sm mx-auto">
            <div className="border-2 border-blue-500 rounded-2xl p-6 text-center">
              <div className="text-sm text-blue-600 font-medium mb-1">
                永久版
              </div>
              <div className="text-3xl font-bold mb-1">
                ¥19.9
              </div>
              <div className="text-sm text-zinc-400 mb-4">
                一次付费 · 永久使用 · 无限次
              </div>
              <ul className="text-sm text-zinc-600 space-y-2 mb-4 text-left">
                <li>✅ 每日无限次处理</li>
                <li>✅ Excel 无水印</li>
                <li>✅ 优先支持</li>
                <li>✅ 未来新功能免费更新</li>
              </ul>
              <button
                onClick={() => setShowActivate(true)}
                className="w-full py-2.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors"
              >
                立即升级
              </button>
            </div>
          </div>
        )}

        {/* Activation modal */}
        {showActivate && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 max-w-md w-full shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg">
                  {activated ? "已激活" : "升级永久版"}
                </h3>
                <button
                  onClick={() => setShowActivate(false)}
                  className="text-zinc-400 hover:text-zinc-600 text-xl"
                >
                  ✕
                </button>
              </div>

              {activated ? (
                <div className="text-center py-4 text-green-600">
                  ✅ 已激活永久版，感谢支持！
                </div>
              ) : (
                <>
                  {/* Payment info */}
                  <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-4 mb-4 text-center">
                    <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-2">
                      微信扫码支付 <strong>¥19.9</strong>
                    </p>
                    <img
                      src="/pdf-tool/qrcode.jpg"
                      alt="微信收款码"
                      className="w-40 h-40 mx-auto rounded-lg border border-zinc-200 object-cover"
                    />
                    {!paidCode ? (
                      <button
                        onClick={handlePaid}
                        className="mt-3 px-6 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                      >
                        我已付款，获取激活码
                      </button>
                    ) : (
                      <div className="mt-3 p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                        <p className="text-xs text-green-700 dark:text-green-300 mb-1">
                          ✅ 你的永久激活码（请复制保存）：
                        </p>
                        <p className="text-lg font-mono font-bold text-green-800 dark:text-green-200 select-all">
                          {paidCode}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Activation code input (for existing users) */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={actCode}
                      onChange={(e) => setActCode(e.target.value.toUpperCase())}
                      placeholder="已有激活码？在此输入 PT-XXXXXXXXXXXX"
                      className="flex-1 px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg text-sm bg-transparent"
                      maxLength={16}
                    />
                    <button
                      onClick={handleActivate}
                      disabled={actCode.length < 13}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors"
                    >
                      激活
                    </button>
                  </div>
                  {actMsg && (
                    <p
                      className={`text-sm mt-2 ${
                        actStatus === "success"
                          ? "text-green-600"
                          : "text-red-500"
                      }`}
                    >
                      {actMsg}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-zinc-100 dark:border-zinc-800 py-6 text-center text-sm text-zinc-400">
        PDF 转 Excel · 纯浏览器处理 · 文件不上传 · 每日免费 3 次
      </footer>
    </div>
  );
}

function generateExcel(
  tables: ExtractedTable[],
  originalFilename: string,
  addWatermark: boolean
): ArrayBuffer {
  const workbook = XLSX.utils.book_new();

  for (let i = 0; i < tables.length; i++) {
    const t = tables[i];
    let sheetData: string[][];

    if (addWatermark) {
      // 第一行加水印提示
      const watermarkRow = Array(t.headers.length).fill("");
      watermarkRow[0] = "【试用版 · 升级永久版去除水印】";
      sheetData = [watermarkRow, t.headers, ...t.rows];
    } else {
      sheetData = [t.headers, ...t.rows];
    }

    const sheet = XLSX.utils.aoa_to_sheet(sheetData);
    const name = (t.title?.slice(0, 31) || `表格${i + 1}`).replace(
      /[\\\/\*\?\[\]:]/g,
      "-"
    );
    XLSX.utils.book_append_sheet(workbook, sheet, name.slice(0, 31));
  }

  workbook.Props = {
    Title: `PDF表格提取 - ${originalFilename}`,
    CreatedDate: new Date(),
  };

  const dataArray = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  return new Uint8Array(dataArray).buffer as ArrayBuffer;
}
