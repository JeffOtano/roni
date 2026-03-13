"use client";

import { Loader2 } from "lucide-react";

/**
 * Shown when we first fetch Tonal data (e.g. workout history for cold-start gate).
 * Replaces a bare spinner with a progress message per North Star spec.
 */
export function TonalDataLoader() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4">
      <Loader2 className="size-8 animate-spin text-primary" />
      <div className="max-w-sm space-y-1 text-center">
        <p className="text-sm font-medium text-foreground">
          Pulling your training history from Tonal…
        </p>
        <p className="text-sm text-muted-foreground">
          I&apos;m about to show you something interesting.
        </p>
      </div>
    </div>
  );
}
