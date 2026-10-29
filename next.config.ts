import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the project root (avoids picking up stray lockfiles in parent folders).
  outputFileTracingRoot: __dirname,
  poweredByHeader: false,
  // Headless Chrome for PDFs must stay a real Node dependency, not bundled.
  serverExternalPackages: ["puppeteer"],
};

export default nextConfig;
