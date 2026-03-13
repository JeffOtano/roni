"use client";

import type { Activity } from "../../convex/tonal/types";
import { Badge } from "@/components/ui/badge";

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

function buildMetaLine(preview: Activity["workoutPreview"]): string | null {
  const meta: string[] = [];
  if (preview.programName) meta.push(preview.programName);
  if (preview.coachName) meta.push(preview.coachName);
  if (preview.level) meta.push(preview.level);
  if (preview.workoutType) meta.push(preview.workoutType);
  return meta.length > 0 ? meta.join(" · ") : null;
}

function WorkoutRow({ activity }: { activity: Activity }) {
  const preview = activity.workoutPreview;
  const metaLine = buildMetaLine(preview);
  const showWork = preview.totalWork != null && preview.totalWork > 0;
  const showAchievements = preview.totalAchievements != null && preview.totalAchievements > 0;

  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-border bg-background/50 px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-foreground leading-tight">
          {preview.workoutTitle}
        </span>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {relativeTime(activity.activityTime)}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {preview.targetArea && (
          <Badge variant="secondary" className="text-[10px]">
            {preview.targetArea}
          </Badge>
        )}
        {metaLine && <span className="text-[11px] text-muted-foreground">{metaLine}</span>}
      </div>
      <div className="flex items-center gap-3 text-xs tabular-nums text-muted-foreground">
        <span>{formatVolume(preview.totalVolume)} volume</span>
        <span>{formatDuration(preview.totalDuration)}</span>
        {showWork && <span>{formatVolume(preview.totalWork!)} work</span>}
        {showAchievements && <span>{preview.totalAchievements} achievements</span>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RecentWorkoutsList
// ---------------------------------------------------------------------------

interface RecentWorkoutsListProps {
  workouts: Activity[];
}

const MAX_RECENT = 5;

export function RecentWorkoutsList({ workouts }: RecentWorkoutsListProps) {
  const list = workouts.slice(0, MAX_RECENT);

  if (list.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 transition-shadow hover:shadow-md hover:shadow-black/10">
        <h2 className="mb-4 text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Recent Workouts
        </h2>
        <p className="text-sm text-muted-foreground">No recent workouts.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 transition-shadow hover:shadow-md hover:shadow-black/10">
      <h2 className="mb-4 text-sm font-medium text-muted-foreground uppercase tracking-wider">
        Recent Workouts
      </h2>
      <div className="flex flex-col gap-2">
        {list.map((activity) => (
          <WorkoutRow key={activity.activityId} activity={activity} />
        ))}
      </div>
    </div>
  );
}
