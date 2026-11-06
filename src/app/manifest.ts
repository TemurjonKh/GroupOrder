import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GroupOrder",
    short_name: "GroupOrder",
    description: "Pick lunch together.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f4ee",
    theme_color: "#d0381a",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
