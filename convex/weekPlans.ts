/**
 * Week plans: public API.
 * Queries and mutations callable from the frontend. Also re-exports internal
 * functions from weekPlanInternals.ts to keep the `internal.weekPlans.*` path.
 *
 * Related files:
 *   weekPlanHelpers.ts     -- constants, validators, date utils (no DB)
 *   weekPlanActions.ts     -- actions (programWeek, programMyWeek)
 *   weekPlanInternals.ts   -- internal queries/mutations (for agent, crons, actions)
 *   weekPlanEnriched.ts    -- enrichment action (joins with Tonal activity data)
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getEffectiveUserId } from "./lib/auth";
import {
  daySlotValidator,
  dayStatusValidator,
  DEFAULT_DAYS,
  getWeekStartDateString,
  isValidWeekStartDateString,
  preferredSplitValidator,
} from "./weekPlanHelpers";

// Re-export for external consumers
export {
  getWeekStartDateString,
  isValidWeekStartDateString,
  preferredSplitValidator,
} from "./weekPlanHelpers";

// Re-export internal functions to preserve internal API paths (internal.weekPlans.*)
export {
  getByUserIdAndWeekStartInternal,
  getWeekPlanDaysWithWorkoutPlanInternal,
  setDayStatusInternal,
  linkWorkoutPlanToDayInternal,
  createForUserInternal,
  batchUpdateDayStatusesInternal,
  createDraftWorkoutInternal,
  deleteWeekPlanInternal,
  getWeekPlanById,
  deleteDraftWorkout,
  replaceDraftWithPushed,
} from "./weekPlanInternals";

/** Get the current week's plan for the authenticated user. */
export const getCurrentWeekPlan = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) return null;
    const weekStartDate = getWeekStartDateString(new Date());
    return await ctx.db
      .query("weekPlans")
      .withIndex("by_userId_weekStartDate", (q) =>
        q.eq("userId", userId).eq("weekStartDate", weekStartDate),
      )
      .first();
  },
});

/** Get a week plan by user and week start date (YYYY-MM-DD, Monday). */
export const getByUserIdAndWeekStart = query({
  args: { weekStartDate: v.string() },
  handler: async (ctx, { weekStartDate }) => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) return null;
    return await ctx.db
      .query("weekPlans")
      .withIndex("by_userId_weekStartDate", (q) =>
        q.eq("userId", userId).eq("weekStartDate", weekStartDate),
      )
      .first();
  },
});

/** Create a week plan for the authenticated user. */
export const create = mutation({
  args: {
    weekStartDate: v.string(),
    preferredSplit: preferredSplitValidator,
    targetDays: v.number(),
    days: v.optional(v.array(daySlotValidator)),
  },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    if (!isValidWeekStartDateString(args.weekStartDate)) {
      throw new Error(
        "weekStartDate must be YYYY-MM-DD (e.g. 2026-03-10 for Monday of that week).",
      );
    }
    const existing = await ctx.db
      .query("weekPlans")
      .withIndex("by_userId_weekStartDate", (q) =>
        q.eq("userId", userId).eq("weekStartDate", args.weekStartDate),
      )
      .unique();
    if (existing) {
      throw new Error(`Week plan already exists for ${args.weekStartDate}. Use update instead.`);
    }
    const now = Date.now();
    const days =
      args.days && args.days.length === 7 ? args.days : DEFAULT_DAYS.map((d) => ({ ...d }));
    return await ctx.db.insert("weekPlans", {
      userId,
      weekStartDate: args.weekStartDate,
      preferredSplit: args.preferredSplit,
      targetDays: args.targetDays,
      days,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/** Update an existing week plan. Only provided fields are patched. */
export const update = mutation({
  args: {
    weekPlanId: v.id("weekPlans"),
    preferredSplit: v.optional(preferredSplitValidator),
    targetDays: v.optional(v.number()),
    days: v.optional(v.array(daySlotValidator)),
  },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const plan = await ctx.db.get(args.weekPlanId);
    if (!plan || plan.userId !== userId) {
      throw new Error("Week plan not found or access denied");
    }
    if (args.days !== undefined && args.days.length !== 7) {
      throw new Error("days must have exactly 7 elements (Mon-Sun)");
    }
    await ctx.db.patch(args.weekPlanId, {
      updatedAt: Date.now(),
      ...(args.preferredSplit !== undefined && { preferredSplit: args.preferredSplit }),
      ...(args.targetDays !== undefined && { targetDays: args.targetDays }),
      ...(args.days !== undefined && { days: args.days }),
    });
    return args.weekPlanId;
  },
});

/** Link a workout plan to a specific day (0 = Monday, 6 = Sunday). */
export const linkWorkoutPlanToDay = mutation({
  args: {
    weekPlanId: v.id("weekPlans"),
    dayIndex: v.number(),
    workoutPlanId: v.id("workoutPlans"),
    status: v.optional(dayStatusValidator),
    estimatedDuration: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    if (args.dayIndex < 0 || args.dayIndex > 6) {
      throw new Error("dayIndex must be 0 (Monday) through 6 (Sunday)");
    }
    const plan = await ctx.db.get(args.weekPlanId);
    if (!plan || plan.userId !== userId) {
      throw new Error("Week plan not found or access denied");
    }
    const workout = await ctx.db.get(args.workoutPlanId);
    if (!workout || workout.userId !== userId) {
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

export { programMyWeek, programWeek } from "./weekPlanActions";
