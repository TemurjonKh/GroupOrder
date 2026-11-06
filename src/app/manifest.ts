import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GroupOrder",
    short_name: "GroupOrder",
    description: "Pick lunch together.",
    start_url: "/",
    display: "standalone",
    background_color: "#faf9f5",
    theme_color: "#1f66c4",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
