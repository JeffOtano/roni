"use client";

import { Sparkles } from "lucide-react";

export function ThinkingIndicator() {
  return (
    <div
      className="animate-in fade-in slide-in-from-bottom-2 border-l-2 border-primary/20 px-4 py-5 duration-200 sm:px-6 sm:py-6"
      role="status"
      aria-label="Coach is thinking"
    >
      <div className="mb-2 flex items-center gap-2.5">
        <div className="flex size-7 items-center justify-center rounded-full bg-linear-to-br from-primary to-[oklch(0.6_0.22_300)] shadow-sm shadow-primary/20">
          <Sparkles className="size-3.5 text-white" />
        </div>
        <span className="text-xs font-medium text-primary">Coach</span>
      </div>
      <div className="max-w-prose pl-[38px]">
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block size-1.5 rounded-full bg-primary/50 motion-safe:animate-[thinking-dot_1.4s_ease-in-out_infinite]"
            aria-hidden="true"
          />
          <span
            className="inline-block size-1.5 rounded-full bg-primary/50 motion-safe:animate-[thinking-dot_1.4s_ease-in-out_0.2s_infinite]"
            aria-hidden="true"
          />
          <span
            className="inline-block size-1.5 rounded-full bg-primary/50 motion-safe:animate-[thinking-dot_1.4s_ease-in-out_0.4s_infinite]"
            aria-hidden="true"
          />
        </div>
        <span className="sr-only">Coach is thinking</span>
      </div>
    </div>
  );
}
