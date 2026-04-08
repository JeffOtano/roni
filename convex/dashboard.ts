import { action, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { getEffectiveUserId } from "./lib/auth";
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

// ---------------------------------------------------------------------------
// 6. getReadinessScore — computes a 0-100 recovery score from last 7 days
//    of health snapshots.
// ---------------------------------------------------------------------------

type ReadinessTrend = "up" | "down" | "stable";

interface ReadinessFactor {
  value: number | null;
  formatted: string;
  trend: ReadinessTrend;
}

interface ReadinessScore {
  score: number;
  label: "Ready" | "Moderate" | "Recovery";
  factors: {
    sleep: ReadinessFactor;
    hrv: ReadinessFactor;
    rhr: ReadinessFactor;
    load: ReadinessFactor;
  };
}

export const getReadinessScore = query({
  args: {},
  handler: async (ctx): Promise<ReadinessScore> => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const snapshots = await ctx.db
      .query("healthSnapshots")
      .withIndex("by_userId_date", (q) => q.eq("userId", userId).gte("date", sevenDaysAgo))
      .order("desc")
      .take(7);

    // Most recent snapshot is the "today" reading
    const today = snapshots[0];

    let score = 100;

    // --- HRV penalty ---
    const hrvValues = snapshots
      .map((s) => s.hrvSDNN)
      .filter((v): v is number => v !== undefined && v !== null);
    const todayHrv = today?.hrvSDNN ?? null;
    let hrvTrend: ReadinessTrend = "stable";

    if (todayHrv !== null && hrvValues.length >= 2) {
      const avg = hrvValues.reduce((a, b) => a + b, 0) / hrvValues.length;
      const pctBelow = (avg - todayHrv) / avg;
      if (pctBelow > 0.2) {
        score -= 25;
        hrvTrend = "down";
      } else if (pctBelow > 0.1) {
        score -= 15;
        hrvTrend = "down";
      } else if (todayHrv > avg * 1.05) {
        hrvTrend = "up";
      }
    }

    // --- Sleep penalty ---
    const todaySleepMin = today?.sleepDurationMinutes ?? null;
    const todayDeepMin = today?.sleepDeepMinutes ?? null;

    if (todaySleepMin !== null) {
      const sleepHours = todaySleepMin / 60;
      if (sleepHours < 6) {
        score -= 20;
      } else if (sleepHours < 7) {
        score -= 10;
      }
    }
    if (todayDeepMin !== null && todayDeepMin < 45) {
      score -= 5;
    }

    const sleepPrev = snapshots
      .slice(1)
      .map((s) => s.sleepDurationMinutes)
      .filter((v): v is number => v !== undefined && v !== null);
    let sleepTrend: ReadinessTrend = "stable";
    if (todaySleepMin !== null && sleepPrev.length > 0) {
      const avgPrev = sleepPrev.reduce((a, b) => a + b, 0) / sleepPrev.length;
      if (todaySleepMin > avgPrev * 1.05) sleepTrend = "up";
      else if (todaySleepMin < avgPrev * 0.95) sleepTrend = "down";
    }

    // --- RHR penalty ---
    const rhrValues = snapshots
      .map((s) => s.restingHeartRate)
      .filter((v): v is number => v !== undefined && v !== null);
    const todayRhr = today?.restingHeartRate ?? null;
    let rhrTrend: ReadinessTrend = "stable";

    if (todayRhr !== null && rhrValues.length >= 2) {
      const avg = rhrValues.reduce((a, b) => a + b, 0) / rhrValues.length;
      if (todayRhr > avg + 5) {
        score -= 10;
        rhrTrend = "up"; // higher RHR = worse
      } else if (todayRhr < avg - 2) {
        rhrTrend = "down"; // lower = better, but we label the trend as "down"
      }
    }

    // --- Load factor (effort score or active energy, informational only) ---
    const todayLoad = today?.workoutEffortScore ?? today?.activeEnergyBurned ?? null;
    const loadPrev = snapshots
      .slice(1)
      .map((s) => s.workoutEffortScore ?? s.activeEnergyBurned)
      .filter((v): v is number => v !== undefined && v !== null);
    let loadTrend: ReadinessTrend = "stable";
    if (todayLoad !== null && loadPrev.length > 0) {
      const avgPrev = loadPrev.reduce((a, b) => a + b, 0) / loadPrev.length;
      if (todayLoad > avgPrev * 1.1) loadTrend = "up";
      else if (todayLoad < avgPrev * 0.9) loadTrend = "down";
    }

    // Clamp to [0, 100]
    const finalScore = Math.max(0, Math.min(100, score));

    const label: "Ready" | "Moderate" | "Recovery" =
      finalScore >= 75 ? "Ready" : finalScore >= 50 ? "Moderate" : "Recovery";

    return {
      score: finalScore,
      label,
      factors: {
        sleep: {
          value: todaySleepMin,
          formatted:
            todaySleepMin !== null
              ? `${Math.floor(todaySleepMin / 60)}h ${todaySleepMin % 60}m`
              : "No data",
          trend: sleepTrend,
        },
        hrv: {
          value: todayHrv,
          formatted: todayHrv !== null ? `${Math.round(todayHrv)} ms` : "No data",
          trend: hrvTrend,
        },
        rhr: {
          value: todayRhr,
          formatted: todayRhr !== null ? `${Math.round(todayRhr)} bpm` : "No data",
          trend: rhrTrend,
        },
        load: {
          value: todayLoad,
          formatted: todayLoad !== null ? `${Math.round(todayLoad)}` : "No data",
          trend: loadTrend,
        },
      },
    };
  },
});

// ---------------------------------------------------------------------------
// 7. getCoachInsight — deterministic insight based on readiness signals
// ---------------------------------------------------------------------------

interface CoachInsight {
  insight: string;
}

export const getCoachInsight = query({
  args: {},
  handler: async (ctx): Promise<CoachInsight> => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const snapshots = await ctx.db
      .query("healthSnapshots")
      .withIndex("by_userId_date", (q) => q.eq("userId", userId).gte("date", sevenDaysAgo))
      .order("desc")
      .take(7);

    if (snapshots.length === 0) {
      return { insight: "Ask your coach about today's plan" };
    }

    const today = snapshots[0];

    // Check HRV trend: compare today vs prior average
    const todayHrv = today?.hrvSDNN ?? null;
    const priorHrv = snapshots
      .slice(1)
      .map((s) => s.hrvSDNN)
      .filter((v): v is number => v !== undefined && v !== null);

    if (todayHrv !== null && priorHrv.length >= 2) {
      const avg = priorHrv.reduce((a, b) => a + b, 0) / priorHrv.length;
      if (todayHrv < avg * 0.9) {
        return { insight: "HRV trending down - consider a lighter session today" };
      }
    }

    // Check sleep
    const sleepMin = today?.sleepDurationMinutes ?? null;
    if (sleepMin !== null && sleepMin < 6 * 60) {
      return { insight: "Short sleep last night - prioritize recovery exercises" };
    }

    // Check for good recovery signals: HRV above average or solid sleep
    const goodHrv =
      todayHrv !== null &&
      priorHrv.length >= 2 &&
      todayHrv > (priorHrv.reduce((a, b) => a + b, 0) / priorHrv.length) * 1.05;
    const goodSleep = sleepMin !== null && sleepMin >= 7 * 60;

    if (goodHrv || goodSleep) {
      return { insight: "Great recovery signals - good day to push intensity" };
    }

    return { insight: "Ask your coach about today's plan" };
  },
});
