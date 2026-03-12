"use client";

import type { MuscleReadiness } from "../../convex/tonal/types";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readinessColor(value: number): string {
  if (value <= 30) return "bg-destructive/20 text-destructive border-destructive/30";
  if (value <= 60) return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
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
  // Convert the readiness object into a sorted array (most fatigued first)
  const entries = Object.entries(readiness)
    .map(([muscle, value]) => ({ muscle, value: value as number }))
    .sort((a, b) => a.value - b.value);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-4 text-sm font-medium text-muted-foreground uppercase tracking-wider">
        Muscle Readiness
      </h2>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {entries.map(({ muscle, value }) => (
          <div
            key={muscle}
            className={cn(
              "flex items-center justify-between rounded-md border px-3 py-2",
              readinessColor(value),
            )}
          >
            <div className="flex flex-col">
              <span className="text-xs font-medium">{muscle}</span>
              <span className="text-[10px] opacity-70">
                {readinessLabel(value)}
              </span>
            </div>
            <span className="text-sm font-bold tabular-nums">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
