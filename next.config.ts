import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Vercel's free plan resizes a limited number of images a month. IMAGES_UNOPTIMIZED=1 serves
    // the brands' originals instead, if that limit is reached.
    unoptimized: process.env.IMAGES_UNOPTIMIZED === "1",
    // Brand photos are large, so they are resized on demand. Add a host here for each new brand.
    remotePatterns: [
      { protocol: "https", hostname: "static.bbqorder.co.kr" },
      { protocol: "https", hostname: "mob-prd.burgerking.co.kr" },
      { protocol: "https", hostname: "www.subway.co.kr" },
      { protocol: "https", hostname: "image.istarbucks.co.kr" },
      { protocol: "https", hostname: "img.mega-mgccoffee.com" },
      { protocol: "https", hostname: "paikdabang.com" },
      { protocol: "https", hostname: "www.baskinrobbins.co.kr" },
      { protocol: "https", hostname: "sulbing.com" },
      { protocol: "https", hostname: "www.kyochon.com" },
      { protocol: "https", hostname: "www.theventi.co.kr" },
      { protocol: "https", hostname: "mmthcoffee.com" },
      { protocol: "https", hostname: "www.puradakchicken.com" },
      { protocol: "https", hostname: "storage.googleapis.com", pathname: "/popeyes-homepage.firebasestorage.app/**" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "momstouch.co.kr" },
      { protocol: "https", hostname: "composecoffee.com" },
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
