import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import type {
  Activity,
  ExternalActivity,
  MuscleReadiness,
  StrengthDistribution,
  StrengthScore,
} from "./tonal/types";

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
    const userId = await ctx.runQuery(internal.lib.auth.resolveEffectiveUserId, {});
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
    const userId = await ctx.runQuery(internal.lib.auth.resolveEffectiveUserId, {});
    if (!userId) throw new Error("Not authenticated");

    return ctx.runAction(internal.tonal.proxy.fetchMuscleReadiness, { userId });
  },
});

// ---------------------------------------------------------------------------
// 3. getWorkoutHistory — recent workouts for the list
// ---------------------------------------------------------------------------

export function isTonalWorkout(a: Activity): boolean {
  const wp = a.workoutPreview;
  if (!wp) return false;
  return a.activityType !== "External" && wp.totalVolume > 0;
}

export const getWorkoutHistory = action({
  args: {},
  handler: async (ctx): Promise<Activity[]> => {
    const userId = await ctx.runQuery(internal.lib.auth.resolveEffectiveUserId, {});
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
    const userId = await ctx.runQuery(internal.lib.auth.resolveEffectiveUserId, {});
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

      const area = activity.workoutPreview?.targetArea;
      if (!area) continue;
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

// ---------------------------------------------------------------------------
// 5. getExternalActivities — recent non-Tonal activities (Apple Watch, etc.)
// ---------------------------------------------------------------------------

export const getExternalActivities = action({
  args: {},
  handler: async (ctx): Promise<ExternalActivity[]> => {
    const userId = await ctx.runQuery(internal.lib.auth.resolveEffectiveUserId, {});
    if (!userId) throw new Error("Not authenticated");

    return ctx.runAction(internal.tonal.proxy.fetchExternalActivities, {
      userId,
      limit: 10,
    });
  },
});
