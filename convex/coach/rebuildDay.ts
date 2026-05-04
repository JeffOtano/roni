/**
 * Rebuild a single day's workout inside an existing week plan with explicit
 * block authoring. Replaces the day's draft workoutPlan with a new one that
 * has the LLM-supplied block structure. Movement IDs are validated; rep vs
 * duration is auto-corrected against the catalog.
 *
 * If the previous day's workout was already pushed to Tonal, this action
 * does NOT auto-re-push — it leaves the new plan in `draft` status. The
 * caller (the LLM) should explicitly approve_week_plan to push.
 */

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { blockInputValidator } from "../validators";
import type { Movement } from "../tonal/types";
import { formatSessionTitle } from "./weekProgrammingHelpers";
import type { SessionType } from "./weekProgrammingHelpers";

export const rebuildDay = internalAction({
  args: {
    userId: v.id("users"),
    weekPlanId: v.id("weekPlans"),
    dayIndex: v.number(),
    title: v.optional(v.string()),
    blocks: blockInputValidator,
  },
  handler: async (
    ctx,
    { userId, weekPlanId, dayIndex, title, blocks },
  ): Promise<{ ok: true; workoutPlanId: Id<"workoutPlans"> } | { ok: false; error: string }> => {
    if (dayIndex < 0 || dayIndex > 6) {
      throw new Error("dayIndex must be 0 (Monday) through 6 (Sunday)");
    }

    const plan = await ctx.runQuery(internal.weekPlans.getWeekPlanById, {
      weekPlanId,
      userId,
    });
    if (!plan) throw new Error("Week plan not found or access denied");

    const day = plan.days[dayIndex];
    if (!day) throw new Error("Invalid day index");
    if (day.sessionType === "rest" || day.sessionType === "recovery") {
      return { ok: false, error: "Cannot rebuild a rest or recovery day" };
    }

    const allMovementIds = blocks.flatMap((b) => b.exercises.map((e) => e.movementId));
    const validatedMovements: Movement[] = await ctx.runQuery(
      internal.tonal.movementSync.getByTonalIds,
      { tonalIds: allMovementIds },
    );
    const validIds = new Set(validatedMovements.map((m) => m.id));
    const invalidIds = allMovementIds.filter((id) => !validIds.has(id));
    if (invalidIds.length > 0) {
      return {
        ok: false,
        error: `Invalid movementIds: ${invalidIds.join(", ")}. Use search_exercises to get valid IDs.`,
      };
    }

    const movementMap = new Map(validatedMovements.map((m) => [m.id, m]));
    const correctedBlocks = blocks.map((block) => ({
      exercises: block.exercises.map((ex) => {
        const movement = movementMap.get(ex.movementId);
        if (movement && !movement.countReps) {
          return { ...ex, duration: ex.duration ?? 30, reps: undefined };
        }
        return { ...ex, reps: ex.reps ?? 10, duration: undefined };
      }),
    }));

    const sessionType = day.sessionType as SessionType;
    const finalTitle = title ?? formatSessionTitle(sessionType, plan.weekStartDate, dayIndex);
    const oldWorkoutPlanId = day.workoutPlanId;

    const newPlanId = (await ctx.runMutation(internal.weekPlans.createDraftWorkoutInternal, {
      userId,
      title: finalTitle,
      blocks: correctedBlocks,
      estimatedDuration: day.estimatedDuration,
    })) as Id<"workoutPlans">;

    await ctx.runMutation(internal.weekPlans.linkWorkoutPlanToDayInternal, {
      userId,
      weekPlanId,
      dayIndex,
      workoutPlanId: newPlanId,
      estimatedDuration: day.estimatedDuration,
    });

    if (oldWorkoutPlanId) {
      await ctx.runMutation(internal.weekPlans.deleteDraftWorkout, {
        workoutPlanId: oldWorkoutPlanId,
      });
    }

    return { ok: true, workoutPlanId: newPlanId };
  },
});
