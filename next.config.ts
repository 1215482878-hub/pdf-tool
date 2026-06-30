import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 允许 API 路由处理最多 5MB 的请求体
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
