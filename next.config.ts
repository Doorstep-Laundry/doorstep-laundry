import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/app", destination: "/", permanent: true },
      { source: "/app/pricing", destination: "/pricing", permanent: true },
    ];
  },
};

export default nextConfig;
