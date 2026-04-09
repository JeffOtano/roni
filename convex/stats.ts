import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Activity, StrengthScoreHistoryEntry } from "./tonal/types";

// ---------------------------------------------------------------------------
// getStrengthHistory — strength score history over time
// ---------------------------------------------------------------------------

export const getStrengthHistory = action({
  args: {},
  handler: async (ctx): Promise<StrengthScoreHistoryEntry[]> => {
    const userId = await ctx.runQuery(internal.lib.auth.resolveEffectiveUserId, {});
    if (!userId) throw new Error("Not authenticated");

    return (await ctx.runAction(internal.tonal.proxy.fetchStrengthHistory, {
      userId,
    })) as StrengthScoreHistoryEntry[];
  },
});

// ---------------------------------------------------------------------------
// getProgressMetrics — aggregated workout metrics from recent history
// ---------------------------------------------------------------------------

interface ProgressMetrics {
  totalWorkouts: number;
  totalVolume: number;
  avgVolume: number;
  totalDuration: number;
  avgDuration: number;
  workoutsByTargetArea: Record<string, number>;
  workoutsPerWeek: number;
}

/** Pure computation of progress metrics from activities. Exported for testing. */
export function computeProgressMetrics(activities: readonly Activity[]): ProgressMetrics {
  if (activities.length === 0) {
    return {
      totalWorkouts: 0,
      totalVolume: 0,
      avgVolume: 0,
      totalDuration: 0,
      avgDuration: 0,
      workoutsByTargetArea: {},
      workoutsPerWeek: 0,
    };
  }

  let totalVolume = 0;
  let totalDuration = 0;
  const workoutsByTargetArea: Record<string, number> = {};

  for (const activity of activities) {
    const preview = activity.workoutPreview;
    totalVolume += preview.totalVolume;
    totalDuration += preview.totalDuration;

    const area = preview.targetArea ?? "Unknown";
    workoutsByTargetArea[area] = (workoutsByTargetArea[area] ?? 0) + 1;
  }

  const totalWorkouts = activities.length;

  const timestamps = activities.map((a) => new Date(a.activityTime).getTime());
  const earliest = Math.min(...timestamps);
  const latest = Math.max(...timestamps);
  const periodMs = latest - earliest;
  const periodWeeks = Math.max(periodMs / (7 * 24 * 60 * 60 * 1000), 1);

  return {
    totalWorkouts,
    totalVolume,
    avgVolume: Math.round(totalVolume / totalWorkouts),
    totalDuration,
    avgDuration: Math.round(totalDuration / totalWorkouts),
    workoutsByTargetArea,
    workoutsPerWeek: Math.round((totalWorkouts / periodWeeks) * 10) / 10,
  };
}

export const getProgressMetrics = action({
  args: {},
  handler: async (ctx): Promise<ProgressMetrics> => {
    const userId = await ctx.runQuery(internal.lib.auth.resolveEffectiveUserId, {});
    if (!userId) throw new Error("Not authenticated");

    const activities = (await ctx.runAction(internal.tonal.proxy.fetchWorkoutHistory, {
      userId,
      limit: 50,
    })) as Activity[];

    return computeProgressMetrics(activities);
  },
});
