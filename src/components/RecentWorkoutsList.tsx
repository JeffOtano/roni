"use client";

import type { Activity } from "../../convex/tonal/types";
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

function buildMetaLine(preview: Activity["workoutPreview"]): string | null {
  const meta: string[] = [];
  if (preview.programName) meta.push(preview.programName);
  if (preview.coachName) meta.push(preview.coachName);
  if (preview.level) meta.push(preview.level);
  if (preview.workoutType) meta.push(preview.workoutType);
  return meta.length > 0 ? meta.join(" · ") : null;
}

function WorkoutRow({ activity, index }: { activity: Activity; index: number }) {
  const preview = activity.workoutPreview;
  const metaLine = buildMetaLine(preview);
  const showWork = preview.totalWork != null && preview.totalWork > 0;
  const showAchievements = preview.totalAchievements != null && preview.totalAchievements > 0;
  const accentColor = ACCENT_COLORS[index % ACCENT_COLORS.length];

  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 rounded-lg border border-white/[0.06] border-l-2 bg-white/[0.02] px-3 py-2.5 transition-all duration-200 hover:bg-white/[0.04]",
        accentColor,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-semibold leading-tight text-foreground">
          {preview.workoutTitle}
        </span>
        <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/60">
          {relativeTime(activity.activityTime)}
        </span>
      </div>
      {(preview.targetArea || metaLine) && (
        <div className="flex flex-wrap items-center gap-2">
          {preview.targetArea && (
            <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {preview.targetArea}
            </span>
          )}
          {metaLine && <span className="text-[11px] text-muted-foreground/60">{metaLine}</span>}
        </div>
      )}
      <div className="flex items-center gap-2">
        <span className="rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
          {formatVolume(preview.totalVolume)}
        </span>
        <span className="rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
          {formatDuration(preview.totalDuration)}
        </span>
        {showWork && (
          <span className="rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
            {formatVolume(preview.totalWork!)} work
          </span>
        )}
        {showAchievements && (
          <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] tabular-nums text-primary">
            {preview.totalAchievements} PRs
          </span>
        )}
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
    return <p className="text-sm text-muted-foreground">No recent workouts.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {list.map((activity, i) => (
        <WorkoutRow key={activity.activityId} activity={activity} index={i} />
      ))}
    </div>
  );
}
