import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api",
        "/dashboard",
        "/chat",
        "/check-ins",
        "/progress",
        "/settings",
        "/login",
        "/connect-tonal",
      ],
    },
    sitemap: "https://tonal.coach/sitemap.xml",
  };
}
