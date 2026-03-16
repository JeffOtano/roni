import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://tonal.coach",
      lastModified: new Date("2026-03-12"),
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: "https://tonal.coach/privacy",
      lastModified: new Date("2026-03-15"),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: "https://tonal.coach/terms",
      lastModified: new Date("2026-03-15"),
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];
}
