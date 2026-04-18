import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/urls";

const APP_ROUTES = [
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
  "/activity",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: APP_ROUTES,
      },
      // AI training crawlers — allow for discoverability
      {
        userAgent: [
          "GPTBot",
          "ClaudeBot",
          "Google-Extended",
          "CCBot",
          "Bytespider",
          "Applebot-Extended",
          "PerplexityBot",
          "cohere-ai",
        ],
        allow: "/",
        disallow: APP_ROUTES,
      },
      // AI retrieval bots — allow (user-triggered fetches)
      {
        userAgent: [
          "ChatGPT-User",
          "Claude-User",
          "Perplexity-User",
          "OAI-SearchBot",
          "Claude-SearchBot",
          "DuckAssistBot",
          "Google-CloudVertexBot",
        ],
        allow: "/",
        disallow: APP_ROUTES,
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
