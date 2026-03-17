/**
 * Workout feedback: RPE and session ratings captured post-workout.
 * Used by the coach to adjust intensity and detect overtraining.
 */

import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { getEffectiveUserId } from "./lib/auth";
import { rateLimiter } from "./rateLimits";

export const submit = mutation({
  args: {
    activityId: v.string(),
    workoutPlanId: v.optional(v.id("workoutPlans")),
    rpe: v.number(),
    rating: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await rateLimiter.limit(ctx, "submitFeedback", { key: userId });

    // Dedup: one feedback per activity per user
    const existing = await ctx.db
      .query("workoutFeedback")
      .withIndex("by_userId_activityId", (q) =>
        q.eq("userId", userId).eq("activityId", args.activityId),
      )
      .first();
    if (existing) throw new Error("Feedback already submitted for this workout");

    const clampedRpe = Math.min(10, Math.max(1, Math.round(args.rpe)));
    const clampedRating = Math.min(5, Math.max(1, Math.round(args.rating)));

    return ctx.db.insert("workoutFeedback", {
      userId,
      activityId: args.activityId,
      workoutPlanId: args.workoutPlanId,
      rpe: clampedRpe,
      rating: clampedRating,
      notes: args.notes?.slice(0, 500),
      createdAt: Date.now(),
    });
  },
});

export const getRecent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) return [];
    const limit = Math.min(args.limit ?? 10, 50);
    return ctx.db
      .query("workoutFeedback")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);
  },
});

export const getByActivityId = query({
  args: { activityId: v.string() },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) return null;
    return ctx.db
      .query("workoutFeedback")
      .withIndex("by_userId_activityId", (q) =>
        q.eq("userId", userId).eq("activityId", args.activityId),
      )
      .first();
  },
});

/** Internal mutation for AI coach tool. */
export const submitInternal = internalMutation({
  args: {
    userId: v.id("users"),
    activityId: v.string(),
    workoutPlanId: v.optional(v.id("workoutPlans")),
    rpe: v.number(),
    rating: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Dedup: skip if already submitted
    const existing = await ctx.db
      .query("workoutFeedback")
      .withIndex("by_userId_activityId", (q) =>
        q.eq("userId", args.userId).eq("activityId", args.activityId),
      )
      .first();
    if (existing) return existing._id;

    return ctx.db.insert("workoutFeedback", {
      userId: args.userId,
      activityId: args.activityId,
      workoutPlanId: args.workoutPlanId,
      rpe: Math.min(10, Math.max(1, Math.round(args.rpe))),
      rating: Math.min(5, Math.max(1, Math.round(args.rating))),
      notes: args.notes?.slice(0, 500),
      createdAt: Date.now(),
    });
  },
});

/** Internal query for AI context builder. */
export const getRecentInternal = internalQuery({
  args: { userId: v.id("users"), limit: v.number() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("workoutFeedback")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(Math.min(args.limit, 200));
  },
});

/** Average RPE over the last N sessions. Used for deload detection. */
export const getAverageRpe = internalQuery({
  args: { userId: v.id("users"), limit: v.number() },
  handler: async (ctx, args) => {
    const feedback = await ctx.db
      .query("workoutFeedback")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(Math.min(args.limit, 50));
    if (feedback.length === 0) return null;
    const sum = feedback.reduce((acc, f) => acc + f.rpe, 0);
    return { average: sum / feedback.length, count: feedback.length };
  },
});
