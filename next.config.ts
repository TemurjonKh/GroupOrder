import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Brand photos are large, so they are resized on demand. Add a host here for each new brand.
    remotePatterns: [
      { protocol: "https", hostname: "static.bbqorder.co.kr" },
      { protocol: "https", hostname: "mob-prd.burgerking.co.kr" },
      { protocol: "https", hostname: "www.subway.co.kr" },
    ],
  },
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
