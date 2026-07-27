import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker 이미지에서 node server.js로 실행하기 위함
  output: "standalone",
};

export default nextConfig;
