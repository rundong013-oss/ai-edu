import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Agent SDK 会拉起子进程、chokidar 监听文件：只在 Node 服务端运行，不打包
  serverExternalPackages: ["@anthropic-ai/claude-agent-sdk", "chokidar"],
  devIndicators: false,
};

export default nextConfig;
