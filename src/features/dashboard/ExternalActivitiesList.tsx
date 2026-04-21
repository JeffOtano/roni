"use client";

import type { DashboardExternalActivity } from "../../../convex/dashboard";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/relativeTime";

function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return remainMins > 0 ? `${hrs}h ${remainMins}m` : `${hrs}h`;
}

function capitalizeType(workoutType: string): string {
  return workoutType
    .replace(/([A-Z])/g, " $1")
    .trim()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ---------------------------------------------------------------------------
// Row component
// ---------------------------------------------------------------------------

function ExternalActivityRow({ activity }: { activity: DashboardExternalActivity }) {
  const showCalories = activity.totalCalories > 0;
  const showHr = activity.averageHeartRate > 0;

  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium leading-tight text-foreground/80">
          {capitalizeType(activity.workoutType)}
        </span>
        <span className="shrink-0 text-2xs tabular-nums text-muted-foreground/60">
          {formatRelativeTime(activity.beginTime)}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-muted/50 px-1.5 py-0.5 text-2xs tabular-nums text-muted-foreground">
          {formatDuration(activity.totalDuration)}
        </span>
        {showCalories && (
          <span className="rounded-md bg-muted/50 px-1.5 py-0.5 text-2xs tabular-nums text-muted-foreground">
            {Math.round(activity.totalCalories)} cal
          </span>
        )}
        {showHr && (
          <span className="rounded-md bg-muted/50 px-1.5 py-0.5 text-2xs tabular-nums text-muted-foreground">
            {Math.round(activity.averageHeartRate)} bpm
          </span>
        )}
        <span className="rounded-md bg-muted/40 px-1.5 py-0.5 text-2xs text-muted-foreground/50">
          {activity.source}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// List component
// ---------------------------------------------------------------------------

interface ExternalActivitiesListProps {
  activities: DashboardExternalActivity[];
}

export function ExternalActivitiesList({ activities }: ExternalActivitiesListProps) {
  if (activities.length === 0) {
    return <p className="text-sm text-muted-foreground">No external activities.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {activities.map((activity) => (
        <ExternalActivityRow key={activity.id} activity={activity} />
      ))}
    </div>
  );
}
