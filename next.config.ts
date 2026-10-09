import type { NextConfig } from "next";

// Publicação no GitHub Pages: exportação estática servida em um subcaminho.
// O workflow define GITHUB_PAGES e NEXT_PUBLIC_BASE_PATH; localmente nada muda.
const pages = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = {
  // A exportação estática não aceita pré-renderização parcial.
  cacheComponents: !pages,
  partialPrefetching: !pages,
  ...(pages && {
    output: "export",
    basePath: process.env.NEXT_PUBLIC_BASE_PATH,
    trailingSlash: true,
    images: { unoptimized: true },
  }),
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
