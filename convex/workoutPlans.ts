import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

export const create = internalMutation({
  args: {
    userId: v.id("users"),
    tonalWorkoutId: v.optional(v.string()),
    title: v.string(),
    blocks: v.any(),
    status: v.union(
      v.literal("draft"),
      v.literal("pushed"),
      v.literal("completed"),
      v.literal("deleted"),
    ),
    estimatedDuration: v.optional(v.number()),
    createdAt: v.number(),
    pushedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("workoutPlans", args);
  },
});

export const markDeleted = internalMutation({
  args: { tonalWorkoutId: v.string() },
  handler: async (ctx, { tonalWorkoutId }) => {
    const plan = await ctx.db
      .query("workoutPlans")
      .filter((q) => q.eq(q.field("tonalWorkoutId"), tonalWorkoutId))
      .unique();

    if (plan) {
      await ctx.db.patch(plan._id, { status: "deleted" as const });
    }
  },
});

export const getByUserId = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("workoutPlans")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
  },
});
