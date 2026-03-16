"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { ScheduleExercise } from "../../../../../convex/schedule";

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

export function formatDayDate(isoDate: string): string {
  const d = new Date(isoDate + "T12:00:00Z");
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// ---------------------------------------------------------------------------
// Session type config (shared with ScheduleDayCard)
// ---------------------------------------------------------------------------

export const SESSION_LABELS: Record<string, string> = {
  push: "Push",
  pull: "Pull",
  legs: "Legs",
  upper: "Upper",
  lower: "Lower",
  full_body: "Full Body",
  recovery: "Recovery",
  rest: "Rest",
};

export const SESSION_BADGE_COLORS: Record<string, string> = {
  push: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  pull: "bg-purple-500/15 text-purple-400 border-purple-500/20",
  legs: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  upper: "bg-orange-400/15 text-orange-300 border-orange-400/20",
  lower: "bg-teal-400/15 text-teal-300 border-teal-400/20",
  full_body: "bg-pink-500/15 text-pink-400 border-pink-500/20",
};

// ---------------------------------------------------------------------------
// Stat card (mirrors workout detail pattern)
// ---------------------------------------------------------------------------

export function StatCard({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col items-center gap-1 py-3">
        {icon}
        <span className="text-lg font-bold tabular-nums text-foreground">{value}</span>
        <span className="text-[10px] text-muted-foreground">{label}</span>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Exercise row (full detail, not truncated)
// ---------------------------------------------------------------------------

export function ExerciseRow({ exercise, index }: { exercise: ScheduleExercise; index: number }) {
  return (
    <li
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg px-3 py-2.5",
        index % 2 === 0 ? "bg-muted/30" : "bg-transparent",
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted/60 text-xs font-medium tabular-nums text-muted-foreground">
          {index + 1}
        </span>
        <span className="text-sm font-medium text-foreground">{exercise.name}</span>
      </div>
      <Badge variant="outline" className="shrink-0 tabular-nums text-xs font-medium">
        {exercise.sets} &times; {exercise.reps ?? "--"}
      </Badge>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

export function ScheduleDetailSkeleton() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8" role="status" aria-label="Loading workout details">
      <Skeleton className="mb-6 h-8 w-32" />
      <Skeleton className="mb-1 h-7 w-64" />
      <Skeleton className="mb-2 h-5 w-40" />
      <Skeleton className="mb-6 h-5 w-24" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>
      <div className="mt-8 space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-11 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
