import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PDF 转 Excel — 免费在线表格提取工具",
  description:
    "上传 PDF，自动提取银行对账单、发票、财务报表中的表格数据，一键导出 Excel。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
