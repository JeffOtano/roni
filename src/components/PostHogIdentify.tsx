"use client";

import posthog from "posthog-js";
import { useConvexAuth, useQuery } from "convex/react";
import { useEffect, useRef } from "react";
import { api } from "../../convex/_generated/api";

export function PostHogIdentify() {
  const { isAuthenticated } = useConvexAuth();
  const me = useQuery(api.users.getMe, isAuthenticated ? {} : "skip");
  const identifiedRef = useRef<string | null>(null);

  useEffect(() => {
    if (me?.userId && identifiedRef.current !== me.userId) {
      posthog.identify(me.userId, {
        email: me.email,
        tonal_connected: !!me.hasTonalProfile,
        onboarding_completed: !!me.onboardingCompleted,
        name: me.tonalName,
      });
      identifiedRef.current = me.userId;
    }

    if (!isAuthenticated && identifiedRef.current) {
      posthog.reset();
      identifiedRef.current = null;
    }
  }, [me, isAuthenticated]);

  return null;
}
