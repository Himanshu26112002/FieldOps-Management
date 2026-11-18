import type { NextConfig } from "next";

// Static export (docs/ARCHITECTURE.md ADR-002): the admin app is served as static files from
// Firebase Hosting on the Spark plan. No server features (route handlers, server actions,
// proxy, rewrites). Detail pages use query strings, since dynamic routes need build-time params.
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  transpilePackages: ["@fieldops/shared-types", "@fieldops/shared-validation"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
