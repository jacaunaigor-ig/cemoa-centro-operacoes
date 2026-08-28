import type { NextConfig } from "next";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;
const staticDeploy = process.env.NEXT_PUBLIC_STATIC === "1";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(staticDeploy
    ? {
        output: "export" as const,
        basePath,
        assetPrefix: basePath,
        images: { unoptimized: true },
        trailingSlash: true,
      }
    : {}),
};

export default nextConfig;
