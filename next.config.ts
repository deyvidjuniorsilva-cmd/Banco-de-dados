import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.8"],
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
