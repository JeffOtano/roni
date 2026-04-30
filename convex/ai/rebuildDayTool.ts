/**
 * AI agent tool for full-block authoring inside an existing week plan.
 *
 * Wraps the `internal.coach.rebuildDay.rebuildDay` action. Prefer over
 * `create_workout` for in-week-plan edits, since `create_workout` writes to
 * Tonal Custom Workouts and is not linked to the weekly schedule.
 */

import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { DAY_NAMES } from "../coach/weekProgrammingHelpers";
import { getWeekStartDateString } from "../weekPlanHelpers";
import { requireUserId, withToolTracking } from "./helpers";

export const rebuildDayTool = createTool({
  description:
    "Rebuild a single day's workout in the current week plan with full block authoring. Prefer this over create_workout when the user's change is to a day already in their week plan — create_workout creates a standalone workout outside the plan. Use this when the user wants the day's structure changed in a way that swap_exercise / add_exercise / set_warmup_block cannot accomplish (e.g. 'make Wednesday a pull/hinge day with a custom warmup, 4 main blocks, and a finisher'). Replaces the day's draft workout. If the day's workout was already pushed to Tonal, the new plan is created as a draft — the user must approve_week_plan to push it. Every movementId MUST come from a prior search_exercises result. For duration-based exercises, use 'duration' (seconds); for rep-based, use 'reps'. Pass warmUp:true to mark warmup exercises.",
  inputSchema: z.object({
    dayIndex: z.number().int().min(0).max(6).describe("Day of the week: 0=Monday..6=Sunday"),
    title: z
      .string()
      .optional()
      .describe(
        "Optional override title. If omitted, an auto title is generated (e.g. 'Full body – Monday').",
      ),
    blocks: z
      .array(
        z.object({
          exercises: z
            .array(
              z.object({
                movementId: z.string().describe("UUID from search_exercises"),
                sets: z.number().int().min(1).max(10).default(3),
                reps: z.number().int().optional(),
                duration: z.number().int().optional(),
                spotter: z.boolean().default(false),
                eccentric: z.boolean().default(false),
                warmUp: z.boolean().default(false),
                chains: z.boolean().optional().describe("Enable chains mode"),
                burnout: z.boolean().optional().describe("Enable burnout/AMRAP on this exercise"),
                dropSet: z.boolean().optional().describe("Enable drop set mode"),
              }),
            )
            .min(1)
            .max(6),
        }),
      )
      .min(1)
      .max(10)
      .describe("Block list. Block 0 is conventionally the warmup."),
  }),
  execute: withToolTracking(
    "rebuild_day",
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

      const result = await ctx.runAction(internal.coach.rebuildDay.rebuildDay, {
        userId,
        weekPlanId: weekPlan._id,
        dayIndex: input.dayIndex,
        title: input.title,
        blocks: input.blocks,
      });
      if (!result.ok) return { success: false, error: result.error };

      const totalExercises = input.blocks.reduce((s, b) => s + b.exercises.length, 0);
      return {
        success: true,
        message: `Rebuilt ${DAY_NAMES[input.dayIndex]} with ${input.blocks.length} blocks and ${totalExercises} exercises. Status: draft. Use approve_week_plan to push to Tonal.`,
      };
    },
  ),
});
