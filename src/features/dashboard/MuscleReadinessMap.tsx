"use client";

import Link from "next/link";
import type { MuscleReadiness } from "../../../convex/tonal/types";
import { cn } from "@/lib/utils";
import { ArrowRight } from "lucide-react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isOrAre(muscle: string): "is" | "are" {
  return muscle.endsWith("s") ? "are" : "is";
}

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
          <Link
            key={muscle}
            href={`/exercises?muscleGroup=${encodeURIComponent(muscle)}`}
            className={cn(
              "group flex items-center justify-between rounded-lg border px-3 py-3 transition-all duration-200",
              readinessColor(value),
            )}
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold">{muscle}</span>
              <span className="text-xs opacity-60">{readinessLabel(value)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold tabular-nums">{value}</span>
              <ArrowRight className="size-3 opacity-0 transition-opacity duration-150 group-hover:opacity-60" />
            </div>
          </Link>
        ))}
      </div>

      {/* Links section */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1">
        {(() => {
          const fresh = entries.find((e) => e.value > 80);
          if (!fresh) return null;
          const prompt = encodeURIComponent(
            `My ${fresh.muscle.toLowerCase()} ${isOrAre(fresh.muscle)} at ${fresh.value}% readiness. Can you program a ${fresh.muscle.toLowerCase()} workout?`,
          );
          return (
            <Link
              href={`/chat?prompt=${prompt}`}
              className="text-xs text-primary/80 transition-colors duration-200 hover:text-primary"
            >
              {fresh.muscle}&nbsp;{isOrAre(fresh.muscle)}&nbsp;fresh — ask coach for a workout
              &rarr;
            </Link>
          );
        })()}
        {(() => {
          const fatigued = entries.find((e) => e.value <= 30);
          if (!fatigued) return null;
          const prompt = encodeURIComponent(
            `My ${fatigued.muscle.toLowerCase()} ${isOrAre(fatigued.muscle)} fatigued at ${fatigued.value}% readiness. What should I do for recovery?`,
          );
          return (
            <Link
              href={`/chat?prompt=${prompt}`}
              className="text-xs text-muted-foreground/80 transition-colors duration-200 hover:text-foreground"
            >
              Rest day tips for {fatigued.muscle.toLowerCase()}&nbsp; &rarr;
            </Link>
          );
        })()}
      </div>
    </div>
  );
}
