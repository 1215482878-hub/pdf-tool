import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  // GitHub Pages project 站点需要子路径
  basePath: "/pdf-tool",
  // 静态导出时不允许有未优化的图片
  images: { unoptimized: true },
};

export default nextConfig;
