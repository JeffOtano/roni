"use client";

import type { Activity } from "../../convex/tonal/types";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

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
// RecentWorkoutsList
// ---------------------------------------------------------------------------

interface RecentWorkoutsListProps {
  workouts: Activity[];
}

export function RecentWorkoutsList({ workouts }: RecentWorkoutsListProps) {
  if (workouts.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-4 text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Recent Workouts
        </h2>
        <p className="text-sm text-muted-foreground">No recent workouts.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-4 text-sm font-medium text-muted-foreground uppercase tracking-wider">
        Recent Workouts
      </h2>

      <ScrollArea className="max-h-[380px]">
        <div className="flex flex-col gap-2 pr-2">
          {workouts.map((activity) => {
            const preview = activity.workoutPreview;
            return (
              <div
                key={activity.activityId}
                className="flex items-start justify-between rounded-md border border-border bg-background/50 px-3 py-2.5"
              >
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-foreground leading-tight">
                    {preview.workoutTitle}
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {relativeTime(activity.activityTime)}
                    </span>
                    {preview.targetArea && (
                      <Badge variant="secondary" className="text-[10px]">
                        {preview.targetArea}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-0.5">
                  <span className="text-xs tabular-nums text-foreground">
                    {formatVolume(preview.totalVolume)}
                  </span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {formatDuration(preview.totalDuration)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
