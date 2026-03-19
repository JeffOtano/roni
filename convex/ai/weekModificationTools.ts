/**
 * AI agent tools for modifying draft week plans.
 *
 * - swapExerciseTool: replace one exercise with another in a day's workout
 * - moveSessionTool: swap two day slots in the week plan
 * - adjustSessionDurationTool: re-generate exercises for a day with a new duration
 */

import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { DAY_NAMES } from "../coach/weekProgrammingHelpers";
import { getWeekStartDateString } from "../weekPlanHelpers";
import { requireUserId, withToolTracking } from "./helpers";

// ---------------------------------------------------------------------------
// swapExerciseTool
// ---------------------------------------------------------------------------

export const swapExerciseTool = createTool({
  description:
    "Swap one exercise for another in a specific day's draft workout. Provide the day index (0=Monday..6=Sunday) and the old/new movement IDs (from search_exercises). Only works on draft workouts.",
  inputSchema: z.object({
    dayIndex: z
      .number()
      .int()
      .min(0)
      .max(6)
      .describe("Day of the week: 0=Monday, 1=Tuesday, ..., 6=Sunday"),
    oldMovementId: z.string().describe("The movement ID to replace"),
    newMovementId: z.string().describe("The replacement movement ID (from search_exercises)"),
  }),
  execute: withToolTracking(
    "swap_exercise",
    async (
      ctx,
      input,
      _options,
    ): Promise<{ success: true; message: string } | { success: false; error: string }> => {
      const userId = requireUserId(ctx);
      const weekStartDate = getWeekStartDateString(new Date());

      const weekPlan = (await ctx.runQuery(internal.weekPlans.getByUserIdAndWeekStartInternal, {
        userId,
        weekStartDate,
      })) as {
        _id: Id<"weekPlans">;
        days: { workoutPlanId?: Id<"workoutPlans">; sessionType: string }[];
      } | null;

      if (!weekPlan) {
        return { success: false, error: "No week plan found for the current week." };
      }

      const day = weekPlan.days[input.dayIndex];
      if (!day?.workoutPlanId) {
        return {
          success: false,
          error: `No workout linked to ${DAY_NAMES[input.dayIndex]}. Nothing to swap.`,
        };
      }

      await ctx.runMutation(internal.coach.weekModifications.swapExerciseInDraft, {
        userId,
        workoutPlanId: day.workoutPlanId,
        oldMovementId: input.oldMovementId,
        newMovementId: input.newMovementId,
      });

      return {
        success: true,
        message: `Swapped exercise on ${DAY_NAMES[input.dayIndex]}. Use get_week_plan_details to see the updated plan.`,
      };
    },
  ),
});

// ---------------------------------------------------------------------------
// addExerciseTool
// ---------------------------------------------------------------------------

export const addExerciseTool = createTool({
  description:
    "Add an exercise to a specific day's draft workout. Use this when the user wants to include an extra exercise (e.g., a finisher, an isolation move) without rebuilding the week. The exercise is added as a new straight-set block before the cooldown. The movementId MUST come from a prior search_exercises result.",
  inputSchema: z.object({
    dayIndex: z.number().int().min(0).max(6).describe("Day of the week: 0=Monday..6=Sunday"),
    movementId: z.string().describe("The movement ID to add (from search_exercises)"),
    sets: z.number().int().min(1).max(6).describe("Number of sets"),
    reps: z.number().int().optional().describe("Reps per set (omit for duration-based exercises)"),
    duration: z
      .number()
      .optional()
      .describe("Duration in seconds (for duration-based exercises like Plank)"),
    eccentric: z.boolean().optional().describe("Enable eccentric mode"),
    spotter: z.boolean().optional().describe("Enable spotter mode"),
    chains: z.boolean().optional().describe("Enable chains mode"),
    burnout: z.boolean().optional().describe("Enable burnout/AMRAP on this exercise"),
    dropSet: z.boolean().optional().describe("Enable drop set mode"),
  }),
  execute: withToolTracking(
    "add_exercise",
    async (
      ctx,
      input,
      _options,
    ): Promise<{ success: true; message: string } | { success: false; error: string }> => {
      const userId = requireUserId(ctx);
      const weekStartDate = getWeekStartDateString(new Date());

      const weekPlan = (await ctx.runQuery(internal.weekPlans.getByUserIdAndWeekStartInternal, {
        userId,
        weekStartDate,
      })) as {
        _id: Id<"weekPlans">;
        days: { workoutPlanId?: Id<"workoutPlans">; sessionType: string }[];
      } | null;

      if (!weekPlan) {
        return { success: false, error: "No week plan found for the current week." };
      }

      const day = weekPlan.days[input.dayIndex];
      if (!day?.workoutPlanId) {
        return {
          success: false,
          error: `No workout linked to ${DAY_NAMES[input.dayIndex]}. Nothing to add to.`,
        };
      }

      const { dayIndex: _, movementId, sets, ...opts } = input;
      await ctx.runMutation(internal.coach.weekModifications.addExerciseToDraft, {
        userId,
        workoutPlanId: day.workoutPlanId,
        movementId,
        sets,
        ...opts,
      });

      return {
        success: true,
        message: `Added exercise to ${DAY_NAMES[input.dayIndex]}. Use get_week_plan_details to see the updated plan.`,
      };
    },
  ),
});

// ---------------------------------------------------------------------------
// moveSessionTool
// ---------------------------------------------------------------------------

export const moveSessionTool = createTool({
  description:
    "Move a training session from one day to another by swapping the two day slots. For example, move Push day from Monday (0) to Wednesday (2). Both slots swap entirely (session type, workout, status).",
  inputSchema: z.object({
    fromDayIndex: z.number().int().min(0).max(6).describe("Source day index: 0=Monday..6=Sunday"),
    toDayIndex: z
      .number()
      .int()
      .min(0)
      .max(6)
      .describe("Destination day index: 0=Monday..6=Sunday"),
  }),
  execute: withToolTracking(
    "move_session",
    async (
      ctx,
      input,
      _options,
    ): Promise<{ success: true; message: string } | { success: false; error: string }> => {
      const userId = requireUserId(ctx);
      const weekStartDate = getWeekStartDateString(new Date());

      const weekPlan = (await ctx.runQuery(internal.weekPlans.getByUserIdAndWeekStartInternal, {
        userId,
        weekStartDate,
      })) as { _id: Id<"weekPlans"> } | null;

      if (!weekPlan) {
        return { success: false, error: "No week plan found for the current week." };
      }

      if (input.fromDayIndex === input.toDayIndex) {
        return { success: false, error: "Source and destination days are the same." };
      }

      await ctx.runMutation(internal.coach.weekModifications.swapDaySlots, {
        userId,
        weekPlanId: weekPlan._id,
        fromDayIndex: input.fromDayIndex,
        toDayIndex: input.toDayIndex,
      });

      return {
        success: true,
        message: `Swapped ${DAY_NAMES[input.fromDayIndex]} and ${DAY_NAMES[input.toDayIndex]}. Use get_week_plan_details to see the updated plan.`,
      };
    },
  ),
});

// ---------------------------------------------------------------------------
// adjustSessionDurationTool
// ---------------------------------------------------------------------------

export const adjustSessionDurationTool = createTool({
  description:
    "Change the duration of a training session on a specific day. Re-selects exercises to fit the new time limit (30 min = 5 exercises, 45 min = 7, 60 min = 9). Creates a new draft workout and replaces the old one.",
  inputSchema: z.object({
    dayIndex: z.number().int().min(0).max(6).describe("Day of the week: 0=Monday..6=Sunday"),
    newDurationMinutes: z.enum(["30", "45", "60"]).describe("New session duration in minutes"),
  }),
  execute: withToolTracking(
    "adjust_session_duration",
    async (
      ctx,
      input,
      _options,
    ): Promise<{ success: true; message: string } | { success: false; error: string }> => {
      const userId = requireUserId(ctx);
      const weekStartDate = getWeekStartDateString(new Date());

      const weekPlan = (await ctx.runQuery(internal.weekPlans.getByUserIdAndWeekStartInternal, {
        userId,
        weekStartDate,
      })) as {
        _id: Id<"weekPlans">;
        days: { sessionType: string; workoutPlanId?: Id<"workoutPlans"> }[];
      } | null;

      if (!weekPlan) {
        return { success: false, error: "No week plan found for the current week." };
      }

      const day = weekPlan.days[input.dayIndex];
      if (!day || day.sessionType === "rest" || day.sessionType === "recovery") {
        return {
          success: false,
          error: `${DAY_NAMES[input.dayIndex]} is a ${day?.sessionType ?? "rest"} day. Cannot adjust duration.`,
        };
      }

      await ctx.runAction(internal.coach.weekModifications.adjustDayDuration, {
        userId,
        weekPlanId: weekPlan._id,
        dayIndex: input.dayIndex,
        newDurationMinutes: parseInt(input.newDurationMinutes) as 30 | 45 | 60,
      });

      return {
        success: true,
        message: `Adjusted ${DAY_NAMES[input.dayIndex]} to ${input.newDurationMinutes} minutes with new exercises. Use get_week_plan_details to see the updated plan.`,
      };
    },
  ),
});
