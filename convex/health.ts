/**
 * Health snapshots: daily Apple Health data synced from the iOS app.
 * Used by the AI coach to correlate recovery metrics with training load.
 */

import { v } from "convex/values";
import { internalQuery, mutation, query } from "./_generated/server";
import { getEffectiveUserId } from "./lib/auth";
import { rateLimiter } from "./rateLimits";

/**
 * Upsert a daily health snapshot for the authenticated user.
 * Called by the iOS app after each HealthKit sync. Merges with any
 * existing snapshot for the same date so partial syncs are additive.
 */
export const syncSnapshot = mutation({
  args: {
    date: v.string(),
    syncedAt: v.number(),

    // Sleep
    sleepDurationMinutes: v.optional(v.number()),
    sleepDeepMinutes: v.optional(v.number()),
    sleepRemMinutes: v.optional(v.number()),
    sleepCoreMinutes: v.optional(v.number()),
    sleepAwakeMinutes: v.optional(v.number()),
    sleepStartTime: v.optional(v.string()),
    sleepEndTime: v.optional(v.string()),

    // Heart & Recovery
    restingHeartRate: v.optional(v.number()),
    hrvSDNN: v.optional(v.number()),
    vo2Max: v.optional(v.number()),
    heartRateRecovery: v.optional(v.number()),
    oxygenSaturation: v.optional(v.number()),

    // Activity
    steps: v.optional(v.number()),
    activeEnergyBurned: v.optional(v.number()),
    exerciseMinutes: v.optional(v.number()),
    standHours: v.optional(v.number()),
    flightsClimbed: v.optional(v.number()),

    // Body
    bodyMass: v.optional(v.number()),
    bodyFatPercentage: v.optional(v.number()),
    leanBodyMass: v.optional(v.number()),

    // Nutrition
    dietaryCalories: v.optional(v.number()),
    dietaryProteinGrams: v.optional(v.number()),

    // Respiratory
    respiratoryRate: v.optional(v.number()),

    // Effort
    workoutEffortScore: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await rateLimiter.limit(ctx, "syncHealthSnapshot", { key: userId });

    const existing = await ctx.db
      .query("healthSnapshots")
      .withIndex("by_userId_date", (q) => q.eq("userId", userId).eq("date", args.date))
      .first();

    if (existing) {
      // Merge: only overwrite fields that are explicitly provided in this sync.
      // Undefined args are omitted from the patch so previously stored values
      // are preserved.
      const patch: Record<string, unknown> = { syncedAt: args.syncedAt };

      if (args.sleepDurationMinutes !== undefined)
        patch.sleepDurationMinutes = args.sleepDurationMinutes;
      if (args.sleepDeepMinutes !== undefined) patch.sleepDeepMinutes = args.sleepDeepMinutes;
      if (args.sleepRemMinutes !== undefined) patch.sleepRemMinutes = args.sleepRemMinutes;
      if (args.sleepCoreMinutes !== undefined) patch.sleepCoreMinutes = args.sleepCoreMinutes;
      if (args.sleepAwakeMinutes !== undefined) patch.sleepAwakeMinutes = args.sleepAwakeMinutes;
      if (args.sleepStartTime !== undefined) patch.sleepStartTime = args.sleepStartTime;
      if (args.sleepEndTime !== undefined) patch.sleepEndTime = args.sleepEndTime;
      if (args.restingHeartRate !== undefined) patch.restingHeartRate = args.restingHeartRate;
      if (args.hrvSDNN !== undefined) patch.hrvSDNN = args.hrvSDNN;
      if (args.vo2Max !== undefined) patch.vo2Max = args.vo2Max;
      if (args.heartRateRecovery !== undefined) patch.heartRateRecovery = args.heartRateRecovery;
      if (args.oxygenSaturation !== undefined) patch.oxygenSaturation = args.oxygenSaturation;
      if (args.steps !== undefined) patch.steps = args.steps;
      if (args.activeEnergyBurned !== undefined) patch.activeEnergyBurned = args.activeEnergyBurned;
      if (args.exerciseMinutes !== undefined) patch.exerciseMinutes = args.exerciseMinutes;
      if (args.standHours !== undefined) patch.standHours = args.standHours;
      if (args.flightsClimbed !== undefined) patch.flightsClimbed = args.flightsClimbed;
      if (args.bodyMass !== undefined) patch.bodyMass = args.bodyMass;
      if (args.bodyFatPercentage !== undefined) patch.bodyFatPercentage = args.bodyFatPercentage;
      if (args.leanBodyMass !== undefined) patch.leanBodyMass = args.leanBodyMass;
      if (args.dietaryCalories !== undefined) patch.dietaryCalories = args.dietaryCalories;
      if (args.dietaryProteinGrams !== undefined)
        patch.dietaryProteinGrams = args.dietaryProteinGrams;
      if (args.respiratoryRate !== undefined) patch.respiratoryRate = args.respiratoryRate;
      if (args.workoutEffortScore !== undefined) patch.workoutEffortScore = args.workoutEffortScore;

      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }

    return ctx.db.insert("healthSnapshots", {
      userId,
      date: args.date,
      syncedAt: args.syncedAt,
      sleepDurationMinutes: args.sleepDurationMinutes,
      sleepDeepMinutes: args.sleepDeepMinutes,
      sleepRemMinutes: args.sleepRemMinutes,
      sleepCoreMinutes: args.sleepCoreMinutes,
      sleepAwakeMinutes: args.sleepAwakeMinutes,
      sleepStartTime: args.sleepStartTime,
      sleepEndTime: args.sleepEndTime,
      restingHeartRate: args.restingHeartRate,
      hrvSDNN: args.hrvSDNN,
      vo2Max: args.vo2Max,
      heartRateRecovery: args.heartRateRecovery,
      oxygenSaturation: args.oxygenSaturation,
      steps: args.steps,
      activeEnergyBurned: args.activeEnergyBurned,
      exerciseMinutes: args.exerciseMinutes,
      standHours: args.standHours,
      flightsClimbed: args.flightsClimbed,
      bodyMass: args.bodyMass,
      bodyFatPercentage: args.bodyFatPercentage,
      leanBodyMass: args.leanBodyMass,
      dietaryCalories: args.dietaryCalories,
      dietaryProteinGrams: args.dietaryProteinGrams,
      respiratoryRate: args.respiratoryRate,
      workoutEffortScore: args.workoutEffortScore,
    });
  },
});

/**
 * Internal query for the AI context builder.
 * Returns snapshots for a user from the last N days, newest first.
 * Call via: ctx.runQuery(internal.health.getRecentSnapshots, { userId, days })
 */
export const getRecentSnapshots = internalQuery({
  args: {
    userId: v.id("users"),
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const windowDays = args.days ?? 14;

    // Compute ISO date cutoff: today minus windowDays days.
    // Using a fixed offset from a known epoch boundary keeps this deterministic.
    const cutoffMs = Date.now() - windowDays * 24 * 60 * 60 * 1000;
    const cutoffDate = new Date(cutoffMs).toISOString().slice(0, 10);

    return ctx.db
      .query("healthSnapshots")
      .withIndex("by_userId_date", (q) => q.eq("userId", args.userId).gte("date", cutoffDate))
      .order("desc")
      .take(windowDays + 1); // bounded: never more than days+1 documents
  },
});

/**
 * Public query for the iOS client: returns recent snapshots for the
 * authenticated user. Defaults to last 14 days, capped at 90.
 */
export const getRecent = query({
  args: {
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) return [];

    const windowDays = Math.min(args.days ?? 14, 90);
    const cutoffMs = Date.now() - windowDays * 24 * 60 * 60 * 1000;
    const cutoffDate = new Date(cutoffMs).toISOString().slice(0, 10);

    return ctx.db
      .query("healthSnapshots")
      .withIndex("by_userId_date", (q) => q.eq("userId", userId).gte("date", cutoffDate))
      .order("desc")
      .take(windowDays + 1);
  },
});
