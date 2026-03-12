import { action } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import type {
  StrengthScore,
  StrengthDistribution,
  MuscleReadiness,
  Activity,
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

export const getWorkoutHistory = action({
  args: {},
  handler: async (ctx): Promise<Activity[]> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    return ctx.runAction(internal.tonal.proxy.fetchWorkoutHistory, {
      userId,
      limit: 20,
    });
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

    const activities: Activity[] = await ctx.runAction(
      internal.tonal.proxy.fetchWorkoutHistory,
      { userId, limit: 50 },
    );

    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const counts: Record<string, number> = {};

    for (const activity of activities) {
      const activityTime = new Date(activity.activityTime).getTime();
      if (activityTime < thirtyDaysAgo) continue;

      const area = activity.workoutPreview?.targetArea ?? "Unknown";
      counts[area] = (counts[area] ?? 0) + 1;
    }

    return Object.entries(counts)
      .map(([targetArea, count]) => ({ targetArea, count }))
      .sort((a, b) => b.count - a.count);
  },
});
