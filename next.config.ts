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
      {
        source: "/daybook",
        destination: "/day-book",
        permanent: false,
      },
      {
        source: "/ledger",
        destination: "/account-ledger",
        permanent: false,
      },
      {
        source: "/staff",
        destination: "/admin/staff",
        permanent: false,
      },
      {
        source: "/settings",
        destination: "/admin/settings",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
