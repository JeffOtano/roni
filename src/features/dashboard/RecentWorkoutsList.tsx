"use client";

import Link from "next/link";
import type { DashboardWorkout } from "../../../convex/dashboard";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Relative date helper (no external library)
// ---------------------------------------------------------------------------

function relativeTime(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  const diffWeek = Math.floor(diffDay / 7);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return "yesterday";
  if (diffDay < 7) return `${diffDay}d ago`;
  if (diffWeek === 1) return "1 week ago";
  if (diffWeek < 5) return `${diffWeek} weeks ago`;

  return new Date(dateString).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return remainMins > 0 ? `${hrs}h ${remainMins}m` : `${hrs}h`;
}

function formatVolume(lbs: number): string {
  if (lbs >= 1000) {
    return `${(lbs / 1000).toFixed(1)}k lbs`;
  }
  return `${Math.round(lbs)} lbs`;
}

// ---------------------------------------------------------------------------
// Helpers for row content
// ---------------------------------------------------------------------------

const ACCENT_COLORS = [
  "border-l-primary",
  "border-l-chart-2",
  "border-l-chart-3",
  "border-l-chart-4",
  "border-l-chart-5",
];

function WorkoutRow({ workout, index }: { workout: DashboardWorkout; index: number }) {
  const showWork = workout.totalWork > 0;
  const accentColor = ACCENT_COLORS[index % ACCENT_COLORS.length];

  return (
    <Link
      href={`/activity/${workout.activityId}`}
      className={cn(
        "group flex flex-col gap-1.5 rounded-lg border border-border border-l-2 bg-muted/30 px-3 py-2.5 transition-all duration-200 hover:bg-muted/50",
        accentColor,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold leading-tight text-foreground">{workout.title}</span>
        <div className="flex shrink-0 items-center gap-1">
          <span className="text-[11px] tabular-nums text-muted-foreground/60">
            {relativeTime(workout.date)}
          </span>
          <ChevronRight className="size-3 text-muted-foreground/40 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
        </div>
      </div>
      {workout.targetArea && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {workout.targetArea}
          </span>
          {workout.workoutType && (
            <span className="text-[11px] text-muted-foreground/60">{workout.workoutType}</span>
          )}
        </div>
      )}
      <div className="flex items-center gap-2">
        <span className="rounded-md bg-muted/50 px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground">
          {formatVolume(workout.totalVolume)}
        </span>
        <span className="rounded-md bg-muted/50 px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground">
          {formatDuration(workout.totalDuration)}
        </span>
        {showWork && (
          <span className="rounded-md bg-muted/50 px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground">
            {formatVolume(workout.totalWork)} work
          </span>
        )}
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// RecentWorkoutsList
// ---------------------------------------------------------------------------

interface RecentWorkoutsListProps {
  workouts: DashboardWorkout[];
}

export function RecentWorkoutsList({ workouts }: RecentWorkoutsListProps) {
  if (workouts.length === 0) {
    return <p className="text-sm text-muted-foreground">No recent workouts.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {workouts.map((workout, i) => (
        <WorkoutRow key={workout.activityId} workout={workout} index={i} />
      ))}
    </div>
  );
}
