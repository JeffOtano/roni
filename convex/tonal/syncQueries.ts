import { v } from "convex/values";
import { internalQuery } from "../_generated/server";

// Exported for tests
export const userIdArgsValidator = { userId: v.id("users") };
export const userIdWithLimitArgsValidator = { userId: v.id("users"), limit: v.number() };

/** Get current strength scores for a user from the local DB. */
export const getCurrentStrengthScores = internalQuery({
  args: userIdArgsValidator,
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("currentStrengthScores")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
  },
});

/** Get the latest muscle readiness snapshot for a user. Returns null if none. */
export const getMuscleReadiness = internalQuery({
  args: userIdArgsValidator,
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("muscleReadiness")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
  },
});

/** Get recent completed workouts, ordered by date descending. */
export const getRecentCompletedWorkouts = internalQuery({
  args: userIdWithLimitArgsValidator,
  handler: async (ctx, { userId, limit }) => {
    return await ctx.db
      .query("completedWorkouts")
      .withIndex("by_userId_date", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);
  },
});

/** Get recent external activities, ordered by beginTime descending. */
export const getRecentExternalActivities = internalQuery({
  args: userIdWithLimitArgsValidator,
  handler: async (ctx, { userId, limit }) => {
    return await ctx.db
      .query("externalActivities")
      .withIndex("by_userId_beginTime", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);
  },
});
