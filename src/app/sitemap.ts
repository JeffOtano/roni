import type { MetadataRoute } from "next";
import { fetchQuery } from "convex/nextjs";
import { api } from "../../convex/_generated/api";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date().toISOString();

  const staticUrls: MetadataRoute.Sitemap = [
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
      url: "https://tonal.coach/workouts",
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
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
      url: "https://tonal.coach/contact",
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
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

  let workoutUrls: MetadataRoute.Sitemap = [];
  try {
    const allSlugs: string[] = [];
    let cursor: string | null = null;
    let isDone = false;
    while (!isDone) {
      const result: { slugs: string[]; isDone: boolean; continueCursor: string } = await fetchQuery(
        api.libraryWorkouts.getSlugsPage,
        {
          paginationOpts: { numItems: 100, cursor },
        },
      );
      allSlugs.push(...result.slugs);
      isDone = result.isDone;
      cursor = result.continueCursor;
    }
    workoutUrls = allSlugs.map((slug: string) => ({
      url: `https://tonal.coach/workouts/${slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));
  } catch (error) {
    console.error("sitemap: failed to fetch workout slugs, returning static URLs only", error);
  }

  return [...staticUrls, ...workoutUrls];
}
