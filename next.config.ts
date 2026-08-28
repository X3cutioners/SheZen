import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Empty turbopack config — acknowledges we're using Turbopack intentionally.
  // next-pwa's webpack config is incompatible with Next 16 Turbopack, so we
  // use a hand-written service worker instead (see /public/sw.js).
  turbopack: {},
};

export default nextConfig;
