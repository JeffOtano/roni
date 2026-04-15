import { action, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { getEffectiveUserId } from "./lib/auth";
import type { MuscleReadiness, StrengthDistribution, StrengthScore } from "./tonal/types";

// ---------------------------------------------------------------------------
// Return types
// ---------------------------------------------------------------------------

interface StrengthData {
  scores: StrengthScore[];
  distribution: StrengthDistribution;
}

export interface DashboardWorkout {
  activityId: string;
  date: string;
  title: string;
  targetArea: string;
  totalVolume: number;
  totalDuration: number;
  totalWork: number;
  workoutType: string;
}

interface TrainingFrequencyEntry {
  targetArea: string;
  count: number;
  lastTrainedDate: string;
}

export interface DashboardExternalActivity {
  id: string;
  workoutType: string;
  beginTime: string;
  totalDuration: number;
  totalCalories: number;
  averageHeartRate: number;
  source: string;
}

// ---------------------------------------------------------------------------
// 1. getStrengthData -- stays as action (needs distribution from Tonal API)
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
// 2. getMuscleReadiness -- query from sync table
// ---------------------------------------------------------------------------

export const getMuscleReadiness = query({
  args: {},
  handler: async (ctx): Promise<MuscleReadiness | null> => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const row = await ctx.db
      .query("muscleReadiness")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    if (!row) return null;

    return {
      Chest: row.chest,
      Shoulders: row.shoulders,
      Back: row.back,
      Triceps: row.triceps,
      Biceps: row.biceps,
      Abs: row.abs,
      Obliques: row.obliques,
      Quads: row.quads,
      Glutes: row.glutes,
      Hamstrings: row.hamstrings,
      Calves: row.calves,
    };
  },
});

// ---------------------------------------------------------------------------
// 3. getWorkoutHistory -- query from sync table
// ---------------------------------------------------------------------------

export const getWorkoutHistory = query({
  args: {},
  handler: async (ctx): Promise<DashboardWorkout[]> => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const rows = await ctx.db
      .query("completedWorkouts")
      .withIndex("by_userId_date", (q) => q.eq("userId", userId))
      .order("desc")
      .take(20);

    return rows
      .filter((r) => r.title !== "")
      .slice(0, 5)
      .map((r) => ({
        activityId: r.activityId,
        date: r.date,
        title: r.title,
        targetArea: r.targetArea,
        totalVolume: r.totalVolume,
        totalDuration: r.totalDuration,
        totalWork: r.totalWork,
        workoutType: r.workoutType,
      }));
  },
});

// ---------------------------------------------------------------------------
// 4. getTrainingFrequency -- query from sync table (last 30 days)
// ---------------------------------------------------------------------------

export const getTrainingFrequency = query({
  args: {},
  handler: async (ctx): Promise<TrainingFrequencyEntry[]> => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const rows = await ctx.db
      .query("completedWorkouts")
      .withIndex("by_userId_date", (q) => q.eq("userId", userId).gte("date", thirtyDaysAgo))
      .collect();

    const counts: Record<string, number> = {};
    const lastDates: Record<string, string> = {};

    for (const row of rows) {
      const area = row.targetArea;
      if (!area) continue;
      counts[area] = (counts[area] ?? 0) + 1;
      if (!lastDates[area] || row.date > lastDates[area]) {
        lastDates[area] = row.date;
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
// 5. getExternalActivities -- query from sync table
// ---------------------------------------------------------------------------

export const getExternalActivities = query({
  args: {},
  handler: async (ctx): Promise<DashboardExternalActivity[]> => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const rows = await ctx.db
      .query("externalActivities")
      .withIndex("by_userId_beginTime", (q) => q.eq("userId", userId))
      .order("desc")
      .take(10);

    return rows.map((r) => ({
      id: r.externalId,
      workoutType: r.workoutType,
      beginTime: r.beginTime,
      totalDuration: r.totalDuration,
      totalCalories: r.totalCalories,
      averageHeartRate: r.averageHeartRate,
      source: r.source,
    }));
  },
});

// ---------------------------------------------------------------------------
// 6. Backfill trigger -- schedules sync for users with no sync data
// ---------------------------------------------------------------------------

/** Trigger a backfill for users who connected before the sync feature existed. */
export const triggerBackfillIfNeeded = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) return;

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    if (!profile || profile.syncStatus) return;

    await ctx.db.patch(profile._id, { syncStatus: "syncing" });
    await ctx.scheduler.runAfter(0, internal.tonal.historySync.backfillUserHistory, { userId });
  },
});
