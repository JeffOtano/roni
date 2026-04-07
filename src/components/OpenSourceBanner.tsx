"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { Sparkles, X } from "lucide-react";

const STORAGE_KEY = "tonal-coach-oss-banner-dismissed";

// No-op subscribe: the dismissal flag only changes via this component's own
// click handler, which sets React state directly. `useSyncExternalStore` is
// used here only for its SSR-safe "server snapshot / client snapshot" split.
function subscribe() {
  return () => {};
}

function getClientSnapshot(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function getServerSnapshot(): boolean {
  // Hide on the server and during the initial client render so hydration
  // matches; the real value is read on the commit following hydration.
  return true;
}

/**
 * Quiet one-time announcement that Tonal Coach is now open source.
 *
 * Rendering rules:
 * - Shows only when `NEXT_PUBLIC_GITHUB_REPO_URL` is set (we won't point users
 *   at a repo that doesn't exist yet).
 * - Dismissal persists in localStorage under `tonal-coach-oss-banner-dismissed`.
 * - SSR-safe: uses `useSyncExternalStore` so the server snapshot always
 *   returns "dismissed" and the real localStorage value is read on the first
 *   client commit, avoiding hydration mismatches.
 */
export function OpenSourceBanner() {
  const repoUrl = process.env.NEXT_PUBLIC_GITHUB_REPO_URL;

  // Start from the stored value on first client commit; the server snapshot
  // returns `true` (dismissed) so SSR renders nothing and hydration matches.
  const storedDismissed = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);

  // Track in-session dismissals independently so the banner can be closed
  // without needing to re-read localStorage.
  const [dismissedInSession, setDismissedInSession] = useState(false);

  const handleDismiss = useCallback(() => {
    setDismissedInSession(true);
    try {
      window.localStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // Best effort; the in-memory state already hid the banner.
    }
  }, []);

  if (!repoUrl) return null;
  if (storedDismissed || dismissedInSession) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="relative flex items-center gap-3 border-b border-primary/20 bg-gradient-to-r from-primary/[0.08] via-primary/[0.05] to-transparent px-4 py-2.5 text-sm text-foreground"
    >
      <Sparkles className="size-4 shrink-0 text-primary" aria-hidden="true" />
      <span className="flex-1">
        Tonal Coach is now open source. Your account is unchanged.{" "}
        <a
          href={repoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-primary underline underline-offset-2 transition-colors duration-200 hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm"
        >
          Read the code
        </a>
        .
      </span>
      <button
        type="button"
        onClick={handleDismiss}
        className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-all duration-200 hover:bg-primary/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        aria-label="Dismiss"
      >
        <X className="size-3.5" />
      </button>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
    </div>
  );
}
