"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider, usePostHog } from "posthog-js/react";
import { useConvexAuth, useQuery } from "convex/react";
import { useEffect, useRef } from "react";
import { api } from "../../convex/_generated/api";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN!;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "/ingest";

if (typeof window !== "undefined" && POSTHOG_KEY) {
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    ui_host: "https://us.posthog.com",
    capture_pageview: false,
    capture_pageleave: true,
    person_profiles: "identified_only",
  });
}

function PostHogIdentify() {
  const ph = usePostHog();
  const { isAuthenticated } = useConvexAuth();
  const me = useQuery(api.users.getMe, isAuthenticated ? {} : "skip");
  const identifiedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!ph) return;

    if (me?.userId && identifiedRef.current !== me.userId) {
      ph.identify(me.userId, {
        email: me.email,
        tonal_connected: !!me.hasTonalProfile,
        onboarding_completed: !!me.onboardingCompleted,
        name: me.tonalName,
      });
      identifiedRef.current = me.userId;
    }

    if (!isAuthenticated && identifiedRef.current) {
      ph.reset();
      identifiedRef.current = null;
    }
  }, [ph, me, isAuthenticated]);

  return null;
}

function PostHogPageview() {
  const ph = usePostHog();

  useEffect(() => {
    if (!ph) return;
    ph.capture("$pageview");
    const handleRouteChange = () => ph.capture("$pageview");
    window.addEventListener("popstate", handleRouteChange);
    return () => window.removeEventListener("popstate", handleRouteChange);
  }, [ph]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  if (!POSTHOG_KEY) return <>{children}</>;

  return (
    <PHProvider client={posthog}>
      <PostHogIdentify />
      <PostHogPageview />
      {children}
    </PHProvider>
  );
}
