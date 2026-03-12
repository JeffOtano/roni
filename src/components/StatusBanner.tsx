"use client";

import { useState } from "react";
import Link from "next/link";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { AlertTriangle, X } from "lucide-react";

export function StatusBanner() {
  const [dismissed, setDismissed] = useState(false);
  const { isAuthenticated } = useConvexAuth();
  const me = useQuery(api.users.getMe, isAuthenticated ? {} : "skip");

  // Nothing to show if dismissed, not loaded, or token is fine
  if (dismissed || !me || !me.tonalTokenExpired) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-300">
      <AlertTriangle className="size-4 shrink-0" />
      <span className="flex-1">
        Your Tonal session expired.{" "}
        <Link
          href="/connect-tonal"
          className="font-medium underline underline-offset-2 hover:text-amber-200"
        >
          Reconnect
        </Link>
      </span>
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 rounded p-0.5 hover:bg-amber-500/20"
        aria-label="Dismiss"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
