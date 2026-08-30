import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse"],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  outputFileTracingIncludes: {
    "/dashboard/importar": ["./node_modules/pdf-parse/dist/worker/**"],
  },
};

export default nextConfig;
