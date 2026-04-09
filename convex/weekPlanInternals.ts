/**
 * Internal mutations and queries for week plan management.
 * Re-exported from weekPlans.ts to preserve the internal API paths.
 */

import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  daySlotValidator,
  dayStatusValidator,
  DEFAULT_DAYS,
  isValidWeekStartDateString,
  preferredSplitValidator,
} from "./weekPlanHelpers";
import { blockInputValidator } from "./validators";

/** Internal: get week plan by userId and weekStartDate (for cron/check-ins). */
export const getByUserIdAndWeekStartInternal = internalQuery({
  args: { userId: v.id("users"), weekStartDate: v.string() },
  handler: async (ctx, { userId, weekStartDate }) => {
    return await ctx.db
      .query("weekPlans")
      .withIndex("by_userId_weekStartDate", (q) =>
        q.eq("userId", userId).eq("weekStartDate", weekStartDate),
      )
      .first();
  },
});

/** Internal: find week plan day slots that reference the given workout plan. */
export const getWeekPlanDaysWithWorkoutPlanInternal = internalQuery({
  args: { userId: v.id("users"), workoutPlanId: v.id("workoutPlans") },
  handler: async (ctx, { userId, workoutPlanId }) => {
    const plans = await ctx.db
      .query("weekPlans")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    const result: { weekPlanId: Id<"weekPlans">; dayIndex: number }[] = [];
    for (const plan of plans) {
      plan.days.forEach((day, dayIndex) => {
        if (day.workoutPlanId === workoutPlanId) {
          result.push({ weekPlanId: plan._id, dayIndex });
        }
      });
    }
    return result;
  },
});

/** Internal: set a single day's status on a week plan. */
export const setDayStatusInternal = internalMutation({
  args: { weekPlanId: v.id("weekPlans"), dayIndex: v.number(), status: dayStatusValidator },
  handler: async (ctx, { weekPlanId, dayIndex, status }) => {
    if (dayIndex < 0 || dayIndex > 6) return;
    const plan = await ctx.db.get(weekPlanId);
    if (!plan || plan.days.length !== 7) return;
    const days = [...plan.days];
    days[dayIndex] = { ...days[dayIndex], status };
    await ctx.db.patch(weekPlanId, { days, updatedAt: Date.now() });
  },
});

/** Internal: link a workout plan to a day (used by programWeek action). */
export const linkWorkoutPlanToDayInternal = internalMutation({
  args: {
    userId: v.id("users"),
    weekPlanId: v.id("weekPlans"),
    dayIndex: v.number(),
    workoutPlanId: v.id("workoutPlans"),
    status: v.optional(dayStatusValidator),
    estimatedDuration: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (args.dayIndex < 0 || args.dayIndex > 6) {
      throw new Error("dayIndex must be 0 (Monday) through 6 (Sunday)");
    }
    const plan = await ctx.db.get(args.weekPlanId);
    if (!plan || plan.userId !== args.userId) {
      throw new Error("Week plan not found or access denied");
    }
    const workout = await ctx.db.get(args.workoutPlanId);
    if (!workout || workout.userId !== args.userId) {
      throw new Error("Workout plan not found or access denied");
    }
    const days = [...plan.days];
    const slot = { ...days[args.dayIndex] };
    slot.workoutPlanId = args.workoutPlanId;
    if (args.status !== undefined) slot.status = args.status;
    if (args.estimatedDuration !== undefined) slot.estimatedDuration = args.estimatedDuration;
    days[args.dayIndex] = slot;
    await ctx.db.patch(args.weekPlanId, { days, updatedAt: Date.now() });
    return args.weekPlanId;
  },
});

/** Internal: create a week plan for a given user (used by programWeek action). */
export const createForUserInternal = internalMutation({
  args: {
    userId: v.id("users"),
    weekStartDate: v.string(),
    preferredSplit: preferredSplitValidator,
    targetDays: v.number(),
    days: v.optional(v.array(daySlotValidator)),
  },
  handler: async (ctx, args) => {
    if (!isValidWeekStartDateString(args.weekStartDate)) {
      throw new Error(
        "weekStartDate must be YYYY-MM-DD (e.g. 2026-03-10 for Monday of that week).",
      );
    }
    const existing = await ctx.db
      .query("weekPlans")
      .withIndex("by_userId_weekStartDate", (q) =>
        q.eq("userId", args.userId).eq("weekStartDate", args.weekStartDate),
      )
      .unique();
    if (existing) {
      throw new Error(`Week plan already exists for ${args.weekStartDate}. Use update instead.`);
    }
    const now = Date.now();
    const days =
      args.days && args.days.length === 7 ? args.days : DEFAULT_DAYS.map((d) => ({ ...d }));
    return await ctx.db.insert("weekPlans", {
      userId: args.userId,
      weekStartDate: args.weekStartDate,
      preferredSplit: args.preferredSplit,
      targetDays: args.targetDays,
      days,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Internal: batch-update day statuses on a week plan (used by enriched action to sync cache). */
export const batchUpdateDayStatusesInternal = internalMutation({
  args: {
    weekPlanId: v.id("weekPlans"),
    updates: v.array(
      v.object({
        dayIndex: v.number(),
        status: dayStatusValidator,
      }),
    ),
  },
  handler: async (ctx, { weekPlanId, updates }) => {
    if (updates.length === 0) return;
    const plan = await ctx.db.get(weekPlanId);
    if (!plan || plan.days.length !== 7) return;
    const days = [...plan.days];
    for (const { dayIndex, status } of updates) {
      if (dayIndex < 0 || dayIndex > 6) continue;
      days[dayIndex] = { ...days[dayIndex], status };
    }
    await ctx.db.patch(weekPlanId, { days, updatedAt: Date.now() });
  },
});

/** Internal: create a draft workout plan (no Tonal push). */
export const createDraftWorkoutInternal = internalMutation({
  args: {
    userId: v.id("users"),
    title: v.string(),
    blocks: blockInputValidator,
    estimatedDuration: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("workoutPlans", {
      userId: args.userId,
      title: args.title,
      blocks: args.blocks,
      status: "draft",
      source: "tonal_coach",
      estimatedDuration: args.estimatedDuration,
      createdAt: Date.now(),
    });
  },
});

/** Internal: delete a week plan and its linked draft workouts. */
export const deleteWeekPlanInternal = internalMutation({
  args: {
    userId: v.id("users"),
    weekPlanId: v.id("weekPlans"),
  },
  handler: async (ctx, args) => {
    const plan = await ctx.db.get(args.weekPlanId);
    if (!plan || plan.userId !== args.userId) {
      throw new Error("Week plan not found or access denied");
    }
    for (const day of plan.days) {
      if (!day.workoutPlanId) continue;
      const workout = await ctx.db.get(day.workoutPlanId);
      if (workout && workout.status === "draft") {
        await ctx.db.delete(day.workoutPlanId);
      }
    }
    await ctx.db.delete(args.weekPlanId);
  },
});

/** Internal: get week plan by ID with ownership check. */
export const getWeekPlanById = internalQuery({
  args: { weekPlanId: v.id("weekPlans"), userId: v.id("users") },
  handler: async (ctx, { weekPlanId, userId }) => {
    const plan = await ctx.db.get(weekPlanId);
    if (!plan || plan.userId !== userId) return null;
    return plan;
  },
});

/** Internal: delete a single draft workout plan. */
export const deleteDraftWorkout = internalMutation({
  args: { workoutPlanId: v.id("workoutPlans") },
  handler: async (ctx, { workoutPlanId }) => {
    const wp = await ctx.db.get(workoutPlanId);
    if (wp && wp.status === "draft") {
      await ctx.db.delete(workoutPlanId);
    }
  },
});

/** Internal: replace a draft workout link with the pushed version. */
export const replaceDraftWithPushed = internalMutation({
  args: {
    weekPlanId: v.id("weekPlans"),
    dayIndex: v.number(),
    oldWorkoutPlanId: v.id("workoutPlans"),
    newWorkoutPlanId: v.id("workoutPlans"),
    estimatedDuration: v.optional(v.number()),
  },
  handler: async (
    ctx,
    { weekPlanId, dayIndex, oldWorkoutPlanId, newWorkoutPlanId, estimatedDuration },
  ) => {
    const plan = await ctx.db.get(weekPlanId);
    if (!plan) return;

    // 1. Patch the day slot FIRST (point to the pushed workout).
    // If this fails, the draft still exists (harmless).
    const days = [...plan.days];
    days[dayIndex] = {
      ...days[dayIndex],
      workoutPlanId: newWorkoutPlanId,
      ...(estimatedDuration != null && { estimatedDuration }),
    };
    await ctx.db.patch(weekPlanId, { days, updatedAt: Date.now() });

    // 2. THEN delete the draft (if it still exists and is still a draft).
    // If this fails, we have an orphaned draft record (harmless cleanup).
    const draft = await ctx.db.get(oldWorkoutPlanId);
    if (draft && draft.status === "draft") {
      await ctx.db.delete(oldWorkoutPlanId);
    }
  },
});
