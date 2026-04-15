import type { MetadataRoute } from "next";
import { fetchQuery } from "convex/nextjs";
import { api } from "../../convex/_generated/api";
import { SITE_URL } from "@/lib/urls";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date().toISOString();

  const staticUrls: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/features`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/how-it-works`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/workouts`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/faq`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/pricing`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/contact`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/privacy`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/terms`,
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
      url: `${SITE_URL}/workouts/${slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));
  } catch (error) {
    console.error("sitemap: failed to fetch workout slugs, returning static URLs only", error);
  }

  return [...staticUrls, ...workoutUrls];
}
