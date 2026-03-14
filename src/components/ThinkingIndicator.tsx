"use client";

import { Sparkles } from "lucide-react";

export function ThinkingIndicator() {
  return (
    <div
      className="animate-in fade-in slide-in-from-bottom-2 px-4 pt-4 pb-2 duration-300 sm:px-6"
      role="status"
      aria-label="Coach is thinking"
    >
      <div className="mb-2 flex items-center gap-2">
        <div className="flex size-6 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[oklch(0.6_0.22_300)]">
          <Sparkles className="size-3 text-white" />
        </div>
        <span className="text-[13px] font-semibold text-foreground">Coach</span>
      </div>
      <div className="sm:pl-8">
        <div className="inline-flex items-center gap-2 rounded-2xl bg-muted/60 px-4 py-2.5">
          <div className="flex items-center gap-1">
            <span
              className="inline-block size-2 rounded-full bg-foreground/30 motion-safe:animate-[thinking-dot_1.4s_ease-in-out_infinite]"
              aria-hidden="true"
            />
            <span
              className="inline-block size-2 rounded-full bg-foreground/30 motion-safe:animate-[thinking-dot_1.4s_ease-in-out_0.2s_infinite]"
              aria-hidden="true"
            />
            <span
              className="inline-block size-2 rounded-full bg-foreground/30 motion-safe:animate-[thinking-dot_1.4s_ease-in-out_0.4s_infinite]"
              aria-hidden="true"
            />
          </div>
        </div>
        <span className="sr-only">Coach is thinking</span>
      </div>
    </div>
  );
}
