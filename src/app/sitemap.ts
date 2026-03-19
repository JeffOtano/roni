import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date().toISOString();
  return [
    {
      url: "https://tonal.coach",
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: "https://tonal.coach/features",
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: "https://tonal.coach/how-it-works",
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: "https://tonal.coach/faq",
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: "https://tonal.coach/pricing",
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: "https://tonal.coach/privacy",
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: "https://tonal.coach/terms",
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];
}
