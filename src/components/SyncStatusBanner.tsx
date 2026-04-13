"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Loader2, X } from "lucide-react";

export function SyncStatusBanner() {
  const [dismissed, setDismissed] = useState(false);
  const { isAuthenticated } = useConvexAuth();
  const me = useQuery(api.users.getMe, isAuthenticated ? {} : "skip");

  // Reset dismissed when syncStatus changes so the banner can reappear after retry.
  // Uses render-time ref comparison instead of useEffect to avoid cascading renders.
  const prevStatus = useRef(me?.syncStatus);
  if (me?.syncStatus !== prevStatus.current) {
    prevStatus.current = me?.syncStatus;
    if (dismissed) setDismissed(false);
  }

  if (!me || !me.syncStatus) return null;
  if (me.syncStatus === "complete") return null;
  if (me.tonalTokenExpired) return null;

  if (me.syncStatus === "syncing") {
    return (
      <div
        role="status"
        className="flex items-center gap-3 border-b border-blue-500/20 bg-gradient-to-r from-blue-500/[0.08] via-blue-500/[0.05] to-transparent px-4 py-2.5 text-sm text-blue-300"
      >
        <Loader2 className="size-4 shrink-0 animate-spin text-blue-400" />
        <span className="flex-1">
          Syncing your Tonal history... your coach may have limited context
        </span>
      </div>
    );
  }

  if (me.syncStatus === "failed" && !dismissed) {
    return (
      <div
        role="alert"
        className="relative flex items-center gap-3 border-b border-red-500/20 bg-gradient-to-r from-red-500/[0.08] via-red-500/[0.05] to-transparent px-4 py-2.5 text-sm text-red-300"
      >
        <span className="flex-1">
          Couldn&apos;t sync your Tonal history. You can retry from{" "}
          <Link
            href="/settings"
            className="font-semibold underline underline-offset-2 transition-colors duration-200 hover:text-red-200"
          >
            Settings
          </Link>
          .
        </span>
        <button
          onClick={() => setDismissed(true)}
          className="flex size-7 shrink-0 items-center justify-center rounded-lg transition-all duration-200 hover:bg-red-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/50"
          aria-label="Dismiss"
        >
          <X className="size-3.5" />
        </button>
      </div>
    );
  }

  return null;
}
