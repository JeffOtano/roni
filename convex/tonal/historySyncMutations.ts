/**
 * Persistence mutations for training history sync.
 *
 * Idempotent inserts into completedWorkouts, exercisePerformance, and
 * strengthScoreSnapshots. Each mutation skips duplicates by checking
 * the relevant index before inserting.
 */

import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";

// ---------------------------------------------------------------------------
// Shared validators (exported for action payload typing)
// ---------------------------------------------------------------------------

export const workoutValidator = v.object({
  activityId: v.string(),
  date: v.string(),
  title: v.string(),
  targetArea: v.string(),
  totalVolume: v.number(),
  totalDuration: v.number(),
  totalWork: v.number(),
  workoutType: v.string(),
  tonalWorkoutId: v.optional(v.string()),
});

export const performanceValidator = v.object({
  activityId: v.string(),
  movementId: v.string(),
  date: v.string(),
  sets: v.number(),
  totalReps: v.number(),
  avgWeightLbs: v.optional(v.number()),
  totalVolume: v.optional(v.number()),
});

export const snapshotValidator = v.object({
  date: v.string(),
  overall: v.number(),
  upper: v.number(),
  lower: v.number(),
  core: v.number(),
  workoutActivityId: v.optional(v.string()),
});

// ---------------------------------------------------------------------------
// Query
// ---------------------------------------------------------------------------

/** Return the set of activityIds that already exist in completedWorkouts. */
export const getExistingActivityIds = internalQuery({
  args: { userId: v.id("users"), activityIds: v.array(v.string()) },
  handler: async (ctx, { userId, activityIds }) => {
    const existing: string[] = [];
    for (const activityId of activityIds) {
      const doc = await ctx.db
        .query("completedWorkouts")
        .withIndex("by_userId_activityId", (q) =>
          q.eq("userId", userId).eq("activityId", activityId),
        )
        .first();
      if (doc) existing.push(activityId);
    }
    return existing;
  },
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Insert new completed workouts (skips duplicates by activityId). */
export const persistCompletedWorkouts = internalMutation({
  args: { userId: v.id("users"), workouts: v.array(workoutValidator) },
  handler: async (ctx, { userId, workouts }) => {
    let inserted = 0;
    for (const w of workouts) {
      const exists = await ctx.db
        .query("completedWorkouts")
        .withIndex("by_userId_activityId", (q) =>
          q.eq("userId", userId).eq("activityId", w.activityId),
        )
        .first();
      if (exists) continue;
      await ctx.db.insert("completedWorkouts", { userId, ...w, syncedAt: Date.now() });
      inserted++;
    }
    return inserted;
  },
});

/** Insert per-exercise performance rows (skips duplicates by activityId + movementId). */
export const persistExercisePerformance = internalMutation({
  args: { userId: v.id("users"), performances: v.array(performanceValidator) },
  handler: async (ctx, { userId, performances }) => {
    for (const p of performances) {
      const existing = await ctx.db
        .query("exercisePerformance")
        .withIndex("by_userId_activityId", (q) =>
          q.eq("userId", userId).eq("activityId", p.activityId),
        )
        .filter((q) => q.eq(q.field("movementId"), p.movementId))
        .first();
      if (existing) continue;
      await ctx.db.insert("exercisePerformance", { userId, ...p, syncedAt: Date.now() });
    }
  },
});

/** Insert strength score snapshots (skips duplicates by userId + date). */
export const persistStrengthSnapshots = internalMutation({
  args: { userId: v.id("users"), snapshots: v.array(snapshotValidator) },
  handler: async (ctx, { userId, snapshots }) => {
    for (const s of snapshots) {
      const exists = await ctx.db
        .query("strengthScoreSnapshots")
        .withIndex("by_userId_date", (q) => q.eq("userId", userId).eq("date", s.date))
        .first();
      if (exists) continue;
      await ctx.db.insert("strengthScoreSnapshots", { userId, ...s, syncedAt: Date.now() });
    }
  },
});
