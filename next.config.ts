import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required by the Dockerfile's runner stage.
  output: "standalone",
  // better-sqlite3 is native; keep it external to the server bundle.
  serverExternalPackages: ["better-sqlite3"],
  async headers() {
    return [
      // Belt and braces with the per-page robots metadata: this app is not for crawlers.
      { source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ];
  },
};

export default nextConfig;
