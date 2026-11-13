import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Puppeteer's Chrome (see .puppeteerrc.cjs) must be part of the standalone server bundle.
  outputFileTracingIncludes: {
    "/**": ["./.puppeteerrc.cjs", "./.cache/puppeteer/**/*"],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
