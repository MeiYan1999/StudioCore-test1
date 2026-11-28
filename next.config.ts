import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  async rewrites() {
    return { beforeFiles: [{ source: "/uploads/:key*", destination: "/api/files/:key*" }], afterFiles: [], fallback: [] };
  },
  devIndicators: false,
};

export default nextConfig;
