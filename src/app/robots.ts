import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api",
        "/chat",
        "/check-ins",
        "/connect-tonal",
        "/dashboard",
        "/exercises",
        "/login",
        "/onboarding",
        "/profile",
        "/progress",
        "/reset-password",
        "/settings",
        "/stats",
        "/strength",
        "/workouts",
      ],
    },
    sitemap: "https://tonal.coach/sitemap.xml",
  };
}
