import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The serverless Chromium archives are read from disk at runtime, so tracing cannot find them alone.
  outputFileTracingIncludes: {
    "/**": ["./node_modules/@sparticuz/chromium/bin/**/*"],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
