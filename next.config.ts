import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  async rewrites() {
    const apiServerUrl = (
      process.env.API_SERVER_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      "http://localhost:8080"
    ).replace(/\/$/, "");

    return [
      {
        source: "/api/backend/:path*",
        destination: `${apiServerUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
