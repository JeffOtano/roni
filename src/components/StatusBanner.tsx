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
    <div
      role="alert"
      className="relative flex items-center gap-3 border-b border-amber-500/20 bg-gradient-to-r from-amber-500/[0.08] via-amber-500/[0.05] to-transparent px-4 py-2.5 text-sm text-amber-300"
    >
      <AlertTriangle className="size-4 shrink-0 text-amber-400" />
      <span className="flex-1">
        Your Tonal session has expired — data can&apos;t refresh until you{" "}
        <Link
          href="/connect-tonal"
          className="font-semibold underline underline-offset-2 transition-colors duration-200 hover:text-amber-200"
        >
          reconnect
        </Link>
        .
      </span>
      <button
        onClick={() => setDismissed(true)}
        className="flex size-7 shrink-0 items-center justify-center rounded-lg transition-all duration-200 hover:bg-amber-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50"
        aria-label="Dismiss"
      >
        <X className="size-3.5" />
      </button>
      {/* Subtle bottom glow */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
    </div>
  );
}
