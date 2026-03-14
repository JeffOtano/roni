"use client";

import Link from "next/link";
import type { MuscleReadiness } from "../../convex/tonal/types";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readinessColor(value: number): string {
  if (value <= 30)
    return "bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/15 hover:shadow-[0_0_12px_oklch(0.65_0.23_15/0.15)]";
  if (value <= 60)
    return "bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/15 hover:shadow-[0_0_12px_oklch(0.8_0.16_85/0.15)]";
  return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/15 hover:shadow-[0_0_12px_oklch(0.7_0.17_155/0.15)]";
}

function readinessLabel(value: number): string {
  if (value <= 30) return "Fatigued";
  if (value <= 60) return "Recovering";
  return "Ready";
}

// ---------------------------------------------------------------------------
// MuscleReadinessMap
// ---------------------------------------------------------------------------

interface MuscleReadinessMapProps {
  readiness: MuscleReadiness;
}

export function MuscleReadinessMap({ readiness }: MuscleReadinessMapProps) {
  // Sort ready muscles first -- positive framing
  const entries = Object.entries(readiness)
    .map(([muscle, value]) => ({ muscle, value: value as number }))
    .sort((a, b) => b.value - a.value);

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {entries.map(({ muscle, value }) => (
          <div
            key={muscle}
            className={cn(
              "flex items-center justify-between rounded-lg border px-3 py-2.5 transition-all duration-200",
              readinessColor(value),
            )}
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold">{muscle}</span>
              <span className="text-[10px] opacity-60">{readinessLabel(value)}</span>
            </div>
            <span className="text-sm font-bold tabular-nums">{value}</span>
          </div>
        ))}
      </div>

      {(() => {
        const fresh = entries.find((e) => e.value > 80);
        if (!fresh) return null;
        const prompt = encodeURIComponent(
          `My ${fresh.muscle.toLowerCase()} is at ${fresh.value}% readiness. Can you program a ${fresh.muscle.toLowerCase()} workout?`,
        );
        return (
          <Link
            href={`/chat?prompt=${prompt}`}
            className="mt-4 block text-xs text-primary/80 transition-colors duration-200 hover:text-primary"
          >
            {fresh.muscle} is fresh — ask coach for a workout &rarr;
          </Link>
        );
      })()}
    </div>
  );
}
