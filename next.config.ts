import type { NextConfig } from "next";
import { getApiServerUrl } from "./lib/env";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  async rewrites() {
    const apiServerUrl = getApiServerUrl();

    return [
      {
        source: "/api/backend/:path*",
        destination: `${apiServerUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
