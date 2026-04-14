import { v } from "convex/values";
import { action, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import * as analytics from "./lib/posthog";
import type { Activity } from "./tonal/types";

interface ExportedData {
  exportedAt: string;
  user: { email: string | null; name: string | null };
  profile: {
    profileData: Record<string, unknown> | null;
    tonalConnectedAt: number | null;
    checkInPreferences: Record<string, unknown> | null;
    lastActiveAt: number;
  } | null;
  workoutPlans: Record<string, unknown>[];
  weekPlans: Record<string, unknown>[];
  checkIns: Record<string, unknown>[];
  completedWorkouts: {
    date: string;
    title: string;
    targetArea: string;
    totalDuration: number;
    totalVolume: number;
    totalWork: number;
    workoutType: string;
  }[];
  exercisePerformance: {
    date: string;
    exerciseName: string;
    movementId: string;
    sets: number;
    totalReps: number;
    avgWeightLbs: number | null;
    totalVolume: number | null;
  }[];
  strengthScoreSnapshots: {
    date: string;
    overall: number;
    upper: number;
    lower: number;
    core: number;
  }[];
  currentStrengthScores: {
    bodyRegion: string;
    score: number;
  }[];
  muscleReadiness: {
    chest: number;
    shoulders: number;
    back: number;
    triceps: number;
    biceps: number;
    abs: number;
    obliques: number;
    quads: number;
    glutes: number;
    hamstrings: number;
    calves: number;
  } | null;
  externalActivities: {
    workoutType: string;
    beginTime: string;
    totalDuration: number;
    activeCalories: number;
    totalCalories: number;
    averageHeartRate: number;
    source: string;
    distance: number;
  }[];
}

/** Convert a Tonal API Activity to the completedWorkouts export format. */
function activityToExportRow(a: Activity) {
  const p = a.workoutPreview;
  return {
    date: a.activityTime.split("T")[0],
    title: p?.workoutTitle ?? "Unknown",
    targetArea: p?.targetArea ?? "",
    totalDuration: p?.totalDuration ?? 0,
    totalVolume: p?.totalVolume ?? 0,
    totalWork: p?.totalWork ?? 0,
    workoutType: p?.workoutType ?? "",
  };
}

export const exportData = action({
  args: {},
  handler: async (ctx): Promise<ExportedData> => {
    const userId = await ctx.runQuery(internal.lib.auth.resolveEffectiveUserId, {});
    if (!userId) throw new Error("Not authenticated");

    const data = (await ctx.runQuery(internal.dataExport.collectUserData, {
      userId,
    })) as ExportedData;

    // Fetch fresh Tonal workout history to supplement synced DB records.
    // Only 2 API calls — workout history and external activities — to avoid
    // overloading the Tonal API.
    if (data.profile?.tonalConnectedAt) {
      try {
        const [knownIds, activities] = await Promise.all([
          ctx.runQuery(internal.dataExport.getKnownActivityIds, { userId }) as Promise<string[]>,
          ctx.runAction(internal.tonal.proxy.fetchWorkoutHistory, {
            userId,
            limit: 500,
          }) as Promise<Activity[]>,
        ]);
        const knownSet = new Set(knownIds);
        for (const a of activities) {
          if (!knownSet.has(a.activityId)) {
            data.completedWorkouts.push(activityToExportRow(a));
          }
        }
        // Sort merged results chronologically
        data.completedWorkouts.sort((a, b) => a.date.localeCompare(b.date));
      } catch (err) {
        console.warn("Tonal API unavailable during export — continuing with DB data only", err);
      }
    }

    analytics.capture(userId, "data_export_requested");
    await analytics.flush();

    return data;
  },
});

export const getKnownActivityIds = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const workouts = await ctx.db
      .query("completedWorkouts")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    return workouts.map((w) => w.activityId);
  },
});

export const collectUserData = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    const workoutPlans = await ctx.db
      .query("workoutPlans")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    const weekPlans = await ctx.db
      .query("weekPlans")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    const checkIns = await ctx.db
      .query("checkIns")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    const completedWorkouts = await ctx.db
      .query("completedWorkouts")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    const exercisePerformanceRows = await ctx.db
      .query("exercisePerformance")
      .withIndex("by_userId_date", (q) => q.eq("userId", userId))
      .collect();

    const strengthScoreSnapshots = await ctx.db
      .query("strengthScoreSnapshots")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    const currentStrengthScores = await ctx.db
      .query("currentStrengthScores")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    const muscleReadinessRow = await ctx.db
      .query("muscleReadiness")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    const externalActivities = await ctx.db
      .query("externalActivities")
      .withIndex("by_userId_beginTime", (q) => q.eq("userId", userId))
      .collect();

    // Build movement ID → name lookup for exercise performance
    const movementIds = new Set(exercisePerformanceRows.map((ep) => ep.movementId));
    const allMovements = await ctx.db.query("movements").collect();
    const movementNames = new Map<string, string>();
    for (const m of allMovements) {
      if (movementIds.has(m.tonalId)) {
        movementNames.set(m.tonalId, m.name);
      }
    }

    return {
      exportedAt: new Date().toISOString(),
      user: {
        email: user?.email ?? null,
        name: user?.name ?? null,
      },
      profile: profile
        ? {
            profileData: profile.profileData ?? null,
            tonalConnectedAt: profile.tonalConnectedAt ?? null,
            checkInPreferences: profile.checkInPreferences ?? null,
            lastActiveAt: profile.lastActiveAt,
          }
        : null,
      workoutPlans: workoutPlans.map((wp) => ({
        title: wp.title,
        status: wp.status,
        blocks: wp.blocks,
        estimatedDuration: wp.estimatedDuration ?? null,
        createdAt: wp.createdAt,
        pushedAt: wp.pushedAt ?? null,
      })),
      weekPlans: weekPlans.map((wp) => ({
        weekStartDate: wp.weekStartDate,
        preferredSplit: wp.preferredSplit,
        targetDays: wp.targetDays,
        days: wp.days,
        createdAt: wp.createdAt,
        updatedAt: wp.updatedAt,
      })),
      checkIns: checkIns.map((ci) => ({
        trigger: ci.trigger,
        message: ci.message,
        readAt: ci.readAt ?? null,
        createdAt: ci.createdAt,
        triggerContext: ci.triggerContext ?? null,
      })),
      completedWorkouts: completedWorkouts.map((cw) => ({
        date: cw.date,
        title: cw.title,
        targetArea: cw.targetArea,
        totalDuration: cw.totalDuration,
        totalVolume: cw.totalVolume,
        totalWork: cw.totalWork,
        workoutType: cw.workoutType,
      })),
      exercisePerformance: exercisePerformanceRows.map((ep) => ({
        date: ep.date,
        exerciseName: movementNames.get(ep.movementId) ?? ep.movementId,
        movementId: ep.movementId,
        sets: ep.sets,
        totalReps: ep.totalReps,
        avgWeightLbs: ep.avgWeightLbs ?? null,
        totalVolume: ep.totalVolume ?? null,
      })),
      strengthScoreSnapshots: strengthScoreSnapshots.map((ss) => ({
        date: ss.date,
        overall: ss.overall,
        upper: ss.upper,
        lower: ss.lower,
        core: ss.core,
      })),
      currentStrengthScores: currentStrengthScores.map((cs) => ({
        bodyRegion: cs.bodyRegion,
        score: cs.score,
      })),
      muscleReadiness: muscleReadinessRow
        ? {
            chest: muscleReadinessRow.chest,
            shoulders: muscleReadinessRow.shoulders,
            back: muscleReadinessRow.back,
            triceps: muscleReadinessRow.triceps,
            biceps: muscleReadinessRow.biceps,
            abs: muscleReadinessRow.abs,
            obliques: muscleReadinessRow.obliques,
            quads: muscleReadinessRow.quads,
            glutes: muscleReadinessRow.glutes,
            hamstrings: muscleReadinessRow.hamstrings,
            calves: muscleReadinessRow.calves,
          }
        : null,
      externalActivities: externalActivities.map((ea) => ({
        workoutType: ea.workoutType,
        beginTime: ea.beginTime,
        totalDuration: ea.totalDuration,
        activeCalories: ea.activeCalories,
        totalCalories: ea.totalCalories,
        averageHeartRate: ea.averageHeartRate,
        source: ea.source,
        distance: ea.distance,
      })),
    };
  },
});
