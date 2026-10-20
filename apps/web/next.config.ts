import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

const nextConfig: NextConfig = {
  transpilePackages: ["@metastorage/shared", "@metastorage/contracts", "@metastorage/api-client"],
  reactStrictMode: true,
  devIndicators: false,
};

export default function config(phase: string): NextConfig {
  return {
    ...nextConfig,
    async rewrites() {
      const target = process.env.API_PROXY_TARGET?.replace(/\/$/, "");
      return target ? [{ source: "/api/:path*", destination: `${target}/:path*` }] : [];
    },
    distDir:
      process.env.METASTORAGE_NEXT_DIST_DIR ??
      (phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next"),
  };
}
