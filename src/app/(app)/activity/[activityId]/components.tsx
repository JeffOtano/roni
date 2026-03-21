"use client";

import type { EnrichedSetActivity, MovementSummary } from "../../../../../convex/workoutDetail";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

export function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
}

export function formatVolume(lbs: number): string {
  if (lbs >= 1_000_000) return `${(lbs / 1_000_000).toFixed(1)}M lbs`;
  if (lbs >= 1_000) return `${(lbs / 1_000).toFixed(1)}k lbs`;
  return `${Math.round(lbs)} lbs`;
}

export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function workoutTypeLabel(workoutType: string): string {
  const labels: Record<string, string> = {
    WEIGHTS: "Strength Training",
    CUSTOM: "Custom Workout",
    FREELIFT: "Free Lift",
    GUIDED: "Guided Workout",
  };
  return labels[workoutType] ?? workoutType;
}

function sideLabel(sideNumber: number): string | null {
  if (sideNumber === 1) return "L";
  if (sideNumber === 2) return "R";
  return null;
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

export function WorkoutDetailSkeleton() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Skeleton className="mb-6 h-8 w-32" />
      <Skeleton className="mb-1 h-7 w-56" />
      <Skeleton className="mb-6 h-4 w-72" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <Skeleton className="mt-6 h-10 rounded-lg" />
      <div className="mt-8 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

export function StatCard({
  icon,
  value,
  label,
  sublabel,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  sublabel?: string;
}) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col items-center gap-1 py-3">
        {icon}
        <span className="text-lg font-bold tabular-nums text-foreground">{value}</span>
        <span className="text-[10px] text-muted-foreground">{label}</span>
        {sublabel && <span className="text-[10px] text-muted-foreground">{sublabel}</span>}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Time breakdown bar
// ---------------------------------------------------------------------------

export function TimeBreakdownBar({
  activeDuration,
  restDuration,
}: {
  activeDuration: number;
  restDuration: number;
}) {
  const total = activeDuration + restDuration;
  if (total === 0) return null;

  const activePercent = Math.round((activeDuration / total) * 100);

  return (
    <Card size="sm">
      <CardContent className="space-y-2 py-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Time Breakdown</span>
          <span>
            {formatDuration(activeDuration)} active / {formatDuration(restDuration)} rest
          </span>
        </div>
        <div
          className="flex h-3 overflow-hidden rounded-full"
          role="img"
          aria-label={`${formatDuration(activeDuration)} active time, ${formatDuration(restDuration)} rest time`}
        >
          <div
            className="rounded-l-full bg-primary motion-safe:transition-all motion-safe:duration-300"
            style={{ width: `${activePercent}%` }}
          />
          <div className="rounded-r-full bg-muted" style={{ width: `${100 - activePercent}%` }} />
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Set row
// ---------------------------------------------------------------------------

function SetRow({ set, setNumber }: { set: EnrichedSetActivity; setNumber: number }) {
  const side = sideLabel(set.sideNumber);

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-muted/30 px-3 py-2 text-sm">
      <div className="flex items-center gap-2">
        <span className="w-5 text-center tabular-nums font-medium text-muted-foreground">
          {setNumber}
        </span>
        <span className="tabular-nums text-foreground">
          {set.repetition}/{set.prescribedReps} reps
        </span>
        {set.weightPercentage != null && (
          <span className="tabular-nums text-muted-foreground">
            @ {Math.round(set.weightPercentage)}%
          </span>
        )}
        {side && (
          <Badge variant="outline" className="text-[10px]">
            {side}
          </Badge>
        )}
      </div>
      <div className="flex gap-1.5">
        {set.spotter && (
          <Badge variant="secondary" className="text-[10px]">
            Spotter
          </Badge>
        )}
        {set.eccentric && (
          <Badge variant="secondary" className="text-[10px]">
            Eccentric
          </Badge>
        )}
        {set.chains && (
          <Badge variant="secondary" className="text-[10px]">
            Chains
          </Badge>
        )}
        {set.warmUp && (
          <Badge variant="outline" className="text-[10px]">
            Warm-up
          </Badge>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Movement card
// ---------------------------------------------------------------------------

export function MovementCard({
  summary,
  sets,
}: {
  summary: MovementSummary;
  sets: EnrichedSetActivity[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold text-foreground">
          {summary.movementName}
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          {summary.muscleGroups.map((group) => (
            <Badge key={group} variant="secondary" className="text-[10px]">
              {group}
            </Badge>
          ))}
          {summary.avgWeightLbs > 0 && (
            <span className="text-xs tabular-nums text-muted-foreground">
              {summary.avgWeightLbs} lbs avg
            </span>
          )}
          {summary.totalVolume > 0 && (
            <span className="text-xs tabular-nums text-muted-foreground">
              {formatVolume(summary.totalVolume)} vol
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {sets.map((set, i) => (
          <SetRow key={set.id} set={set} setNumber={i + 1} />
        ))}
      </CardContent>
    </Card>
  );
}
