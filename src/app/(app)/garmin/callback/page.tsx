"use client";

import { Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAction } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Loader2 } from "lucide-react";

function GarminCallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const completeOAuth = useAction(api.garmin.oauthFlow.completeGarminOAuth);
  // Prevent double-invocation in React Strict Mode dev.
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;

    const oauthToken = params.get("oauth_token");
    const oauthVerifier = params.get("oauth_verifier");

    if (!oauthToken || !oauthVerifier) {
      router.replace("/settings?garmin=error&reason=missing_params");
      return;
    }

    completeOAuth({ oauthToken, oauthVerifier })
      .then((result) => {
        if (result.success) {
          router.replace("/settings?garmin=connected");
        } else {
          const reason = encodeURIComponent(result.error);
          router.replace(`/settings?garmin=error&reason=${reason}`);
        }
      })
      .catch((e) => {
        const reason = encodeURIComponent(e instanceof Error ? e.message : "Unknown error");
        router.replace(`/settings?garmin=error&reason=${reason}`);
      });
  }, [params, router, completeOAuth]);

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-muted-foreground">
      <Loader2 className="size-6 animate-spin" />
      <p className="text-sm">Linking your Garmin account…</p>
    </div>
  );
}

export default function GarminCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
        </div>
      }
    >
      <GarminCallbackInner />
    </Suspense>
  );
}
