import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "tonal.coach",
    short_name: "tonal.coach",
    description: "AI Personal Trainer for Tonal",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#00cacb",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
