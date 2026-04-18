"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

const PHASES = [
  { delay: 0, text: null },
  { delay: 3000, text: "Reviewing your training data..." },
  { delay: 8000, text: "Building your workout context..." },
  { delay: 15000, text: "Generating response..." },
];

export function ThinkingIndicator() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = PHASES.slice(1).map((p, i) => setTimeout(() => setPhase(i + 1), p.delay));
    return () => timers.forEach(clearTimeout);
  }, []);

  const phaseText = PHASES[phase].text;

  return (
    <div
      className="animate-in fade-in slide-in-from-bottom-2 px-4 pt-4 pb-2 duration-300 sm:px-6"
      role="status"
      aria-label="Roni is thinking"
    >
      <div className="mb-2 flex items-center gap-2">
        <div className="flex size-6 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[oklch(0.6_0.22_300)]">
          <Sparkles className="size-3 text-white" />
        </div>
        <span className="text-[13px] font-semibold text-foreground">Roni</span>
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
          {phaseText && (
            <span className="animate-in fade-in text-xs text-muted-foreground duration-300">
              {phaseText}
            </span>
          )}
        </div>
        <span className="sr-only">Roni is thinking</span>
      </div>
    </div>
  );
}
