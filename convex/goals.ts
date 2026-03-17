/**
 * Measurable training goals with deadlines and progress tracking.
 * The coach creates goals during onboarding or conversation, updates progress
 * after workouts, and reports % completion in the training snapshot.
 */

import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { getEffectiveUserId } from "./lib/auth";
import { rateLimiter } from "./rateLimits";

const MAX_ACTIVE_GOALS = 10;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validateGoalInput(args: { title: string; metric: string; deadline: string }) {
  if (args.title.length > 200) throw new Error("Title must be 200 characters or less");
  if (args.metric.length > 100) throw new Error("Metric must be 100 characters or less");
  if (!ISO_DATE_RE.test(args.deadline)) throw new Error("Deadline must be YYYY-MM-DD format");
}

const categoryValidator = v.union(
  v.literal("strength"),
  v.literal("volume"),
  v.literal("consistency"),
  v.literal("body_composition"),
);

export const create = mutation({
  args: {
    title: v.string(),
    category: categoryValidator,
    metric: v.string(),
    baselineValue: v.number(),
    targetValue: v.number(),
    deadline: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await rateLimiter.limit(ctx, "createGoal", { key: userId });
    validateGoalInput(args);

    const activeCount = (
      await ctx.db
        .query("goals")
        .withIndex("by_userId_status", (q) => q.eq("userId", userId).eq("status", "active"))
        .collect()
    ).length;
    if (activeCount >= MAX_ACTIVE_GOALS)
      throw new Error(`Maximum ${MAX_ACTIVE_GOALS} active goals`);

    const now = Date.now();
    return ctx.db.insert("goals", {
      userId,
      title: args.title.slice(0, 200),
      category: args.category,
      metric: args.metric.slice(0, 100),
      baselineValue: args.baselineValue,
      targetValue: args.targetValue,
      currentValue: args.baselineValue,
      deadline: args.deadline,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateProgress = mutation({
  args: {
    goalId: v.id("goals"),
    currentValue: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const goal = await ctx.db.get(args.goalId);
    if (!goal || goal.userId !== userId) throw new Error("Goal not found");

    const reached =
      goal.targetValue > goal.baselineValue
        ? args.currentValue >= goal.targetValue
        : args.currentValue <= goal.targetValue;

    await ctx.db.patch(args.goalId, {
      currentValue: args.currentValue,
      status: reached ? "achieved" : "active",
      updatedAt: Date.now(),
    });
  },
});

export const abandon = mutation({
  args: { goalId: v.id("goals") },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const goal = await ctx.db.get(args.goalId);
    if (!goal || goal.userId !== userId) throw new Error("Goal not found");
    await ctx.db.patch(args.goalId, { status: "abandoned", updatedAt: Date.now() });
  },
});

export const getActive = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) return [];
    return ctx.db
      .query("goals")
      .withIndex("by_userId_status", (q) => q.eq("userId", userId).eq("status", "active"))
      .collect();
  },
});

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) return [];
    return ctx.db
      .query("goals")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

/** Internal: get active goals for AI context. */
export const getActiveInternal = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("goals")
      .withIndex("by_userId_status", (q) => q.eq("userId", args.userId).eq("status", "active"))
      .collect();
  },
});

/** Internal: update goal progress from coach tool. */
export const updateProgressInternal = internalMutation({
  args: {
    goalId: v.id("goals"),
    userId: v.id("users"),
    currentValue: v.number(),
  },
  handler: async (ctx, args) => {
    const goal = await ctx.db.get(args.goalId);
    if (!goal || goal.userId !== args.userId) throw new Error("Goal not found");
    const reached =
      goal.targetValue > goal.baselineValue
        ? args.currentValue >= goal.targetValue
        : args.currentValue <= goal.targetValue;
    await ctx.db.patch(args.goalId, {
      currentValue: args.currentValue,
      status: reached ? "achieved" : "active",
      updatedAt: Date.now(),
    });
    return { reached };
  },
});

/** Internal: create goal from coach tool. */
export const createInternal = internalMutation({
  args: {
    userId: v.id("users"),
    title: v.string(),
    category: categoryValidator,
    metric: v.string(),
    baselineValue: v.number(),
    targetValue: v.number(),
    deadline: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return ctx.db.insert("goals", {
      ...args,
      currentValue: args.baselineValue,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
  },
});
