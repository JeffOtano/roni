import { action } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import type { Activity, MuscleReadiness, StrengthDistribution, StrengthScore } from "./tonal/types";

// ---------------------------------------------------------------------------
// Return types — explicit to avoid TS7022 circular inference
// ---------------------------------------------------------------------------

interface StrengthData {
  scores: StrengthScore[];
  distribution: StrengthDistribution;
}

interface TrainingFrequencyEntry {
  targetArea: string;
  count: number;
  lastTrainedDate: string;
}

// ---------------------------------------------------------------------------
// 1. getStrengthData — scores + distribution (percentile)
// ---------------------------------------------------------------------------

export const getStrengthData = action({
  args: {},
  handler: async (ctx): Promise<StrengthData> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const [scores, distribution] = await Promise.all([
      ctx.runAction(internal.tonal.proxy.fetchStrengthScores, { userId }),
      ctx.runAction(internal.tonal.proxy.fetchStrengthDistribution, { userId }),
    ]);

    return { scores, distribution };
  },
});

// ---------------------------------------------------------------------------
// 2. getMuscleReadiness
// ---------------------------------------------------------------------------

export const getMuscleReadiness = action({
  args: {},
  handler: async (ctx): Promise<MuscleReadiness> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    return ctx.runAction(internal.tonal.proxy.fetchMuscleReadiness, { userId });
  },
});

// ---------------------------------------------------------------------------
// 3. getWorkoutHistory — recent workouts for the list
// ---------------------------------------------------------------------------

function isTonalWorkout(a: Activity): boolean {
  return a.workoutPreview?.totalVolume > 0 || a.workoutPreview?.workoutId !== "";
}

export const getWorkoutHistory = action({
  args: {},
  handler: async (ctx): Promise<Activity[]> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const all: Activity[] = await ctx.runAction(internal.tonal.proxy.fetchWorkoutHistory, {
      userId,
      limit: 20,
    });
    return all.filter(isTonalWorkout).slice(0, 5);
  },
});

// ---------------------------------------------------------------------------
// 4. getTrainingFrequency — aggregated workout counts by target area (30 days)
// ---------------------------------------------------------------------------

export const getTrainingFrequency = action({
  args: {},
  handler: async (ctx): Promise<TrainingFrequencyEntry[]> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const activities: Activity[] = await ctx.runAction(internal.tonal.proxy.fetchWorkoutHistory, {
      userId,
      limit: 50,
    });

    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const counts: Record<string, number> = {};
    const lastDates: Record<string, string> = {};

    for (const activity of activities) {
      if (!isTonalWorkout(activity)) continue;
      const activityTime = new Date(activity.activityTime).getTime();
      if (activityTime < thirtyDaysAgo) continue;

      const area = activity.workoutPreview?.targetArea || "General";
      counts[area] = (counts[area] ?? 0) + 1;

      // Track most recent date per area
      if (!lastDates[area] || activity.activityTime > lastDates[area]) {
        lastDates[area] = activity.activityTime;
      }
    }

    return Object.entries(counts)
      .map(([targetArea, count]) => ({
        targetArea,
        count,
        lastTrainedDate: lastDates[targetArea],
      }))
      .sort((a, b) => b.count - a.count);
  },
});
