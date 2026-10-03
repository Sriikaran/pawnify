import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  async redirects() {
    return [
      {
        source: "/accounts",
        destination: "/admin/accounts",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
