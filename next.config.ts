import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required by the Dockerfile's runner stage.
  output: "standalone",
  // better-sqlite3 is native; keep it external to the server bundle.
  serverExternalPackages: ["better-sqlite3"],
  experimental: {
    // Photo uploads go through a server action, and the default cap is 1MB.
    // Set above MAX_PHOTO_BYTES (5MB) on purpose so our own validation is the
    // binding limit and reports a readable message — hitting the framework cap
    // instead throws an unhandled 413 that takes the whole page down.
    serverActions: { bodySizeLimit: "6mb" },
  },
  async headers() {
    return [
      // Belt and braces with the per-page robots metadata: this app is not for crawlers.
      { source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ];
  },
};

export default nextConfig;
