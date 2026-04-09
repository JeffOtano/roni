/**
 * Push-and-verify flow: pushes all draft workouts in a week plan to Tonal,
 * tracks per-workout success/failure, auto-retries failures once, and returns
 * a structured result.
 */

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import type { ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { DAY_NAMES } from "./weekProgrammingHelpers";
import type { BlockInput } from "../tonal/transforms";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PushResult {
  dayIndex: number;
  dayName: string;
  sessionType: string;
  status: "pushed" | "failed" | "skipped";
  title?: string;
  tonalWorkoutId?: string;
  error?: string;
  exerciseCount?: number;
}

export interface WeekPushResult {
  success: boolean;
  pushed: number;
  failed: number;
  skipped: number;
  results: PushResult[];
}

// ---------------------------------------------------------------------------
// Action
// ---------------------------------------------------------------------------

type CreateWorkoutResult =
  | {
      success: true;
      workoutId: string;
      title: string;
      setCount: number;
      planId: Id<"workoutPlans">;
    }
  | { success: false; error: string; planId: Id<"workoutPlans"> };

type WorkoutPlan = {
  _id: Id<"workoutPlans">;
  title: string;
  blocks: BlockInput[];
  status: string;
  estimatedDuration?: number;
};

type WeekPlanDay = {
  sessionType: string;
  status: string;
  workoutPlanId?: Id<"workoutPlans">;
  estimatedDuration?: number;
};

type WeekPlan = {
  _id: Id<"weekPlans">;
  weekStartDate: string;
  days: WeekPlanDay[];
};

/** Push a single draft workout to Tonal, retrying once on failure. */
async function pushOneWorkout(
  ctx: Pick<ActionCtx, "runAction">,
  userId: Id<"users">,
  wp: WorkoutPlan,
): Promise<CreateWorkoutResult> {
  const push = () =>
    ctx.runAction(internal.tonal.mutations.createWorkout, {
      userId,
      title: wp.title,
      blocks: wp.blocks,
    }) as Promise<CreateWorkoutResult>;

  const first = await push();
  if (first.success) return first;

  // Single retry
  return push();
}

function countExercises(blocks: BlockInput[]): number {
  let count = 0;
  for (const block of blocks) {
    count += block.exercises.length;
  }
  return count;
}

export const pushWeekPlanToTonal = internalAction({
  args: {
    userId: v.id("users"),
    weekPlanId: v.id("weekPlans"),
  },
  handler: async (ctx, { userId, weekPlanId }): Promise<WeekPushResult> => {
    const plan = (await ctx.runQuery(internal.weekPlans.getWeekPlanById, {
      weekPlanId,
      userId,
    })) as WeekPlan | null;

    if (!plan) {
      return { success: false, pushed: 0, failed: 0, skipped: 0, results: [] };
    }

    const results: PushResult[] = [];
    let pushed = 0;
    let failed = 0;
    let skipped = 0;

    for (let i = 0; i < plan.days.length; i++) {
      const day = plan.days[i];
      const dayName = DAY_NAMES[i];

      // Skip rest/recovery days and days without a workout
      if (day.sessionType === "rest" || day.sessionType === "recovery" || !day.workoutPlanId) {
        results.push({
          dayIndex: i,
          dayName,
          sessionType: day.sessionType,
          status: "skipped",
        });
        skipped++;
        continue;
      }

      // Load the workout plan to check its status
      const wp = (await ctx.runQuery(internal.workoutPlans.getById, {
        planId: day.workoutPlanId,
        userId,
      })) as WorkoutPlan | null;

      if (!wp) {
        results.push({
          dayIndex: i,
          dayName,
          sessionType: day.sessionType,
          status: "skipped",
        });
        skipped++;
        continue;
      }

      // Skip already-pushed or completed workouts
      if (wp.status === "pushed" || wp.status === "completed") {
        results.push({
          dayIndex: i,
          dayName,
          sessionType: day.sessionType,
          status: "skipped",
          title: wp.title,
          tonalWorkoutId: undefined,
        });
        skipped++;
        continue;
      }

      // Brief delay between pushes to avoid Tonal API rate limits
      if (pushed > 0) {
        await new Promise((r) => setTimeout(r, 2000));
      }

      const result = await pushOneWorkout(ctx, userId, wp);

      if (result.success) {
        // Swap draft record with the new pushed record
        await ctx.runMutation(internal.weekPlans.replaceDraftWithPushed, {
          weekPlanId,
          dayIndex: i,
          oldWorkoutPlanId: wp._id,
          newWorkoutPlanId: result.planId,
          estimatedDuration: day.estimatedDuration,
        });
        results.push({
          dayIndex: i,
          dayName,
          sessionType: day.sessionType,
          status: "pushed",
          title: result.title,
          tonalWorkoutId: result.workoutId,
          exerciseCount: countExercises(wp.blocks),
        });
        pushed++;
      } else {
        results.push({
          dayIndex: i,
          dayName,
          sessionType: day.sessionType,
          status: "failed",
          title: wp.title,
          error: result.error,
        });
        failed++;
      }
    }

    const outcome: WeekPushResult = {
      success: failed === 0,
      pushed,
      failed,
      skipped,
      results,
    };

    if (failed > 0) {
      const failedDays = results
        .filter((r) => r.status === "failed")
        .map((r) => `${r.dayName}: ${r.error ?? "unknown"}`)
        .join("; ");
      void ctx.runAction(internal.discord.notifyError, {
        source: "pushWeekPlan",
        message: `Week push: ${pushed} pushed, ${failed} failed. Failures: ${failedDays}`,
        userId,
      });
    }

    return outcome;
  },
});
