/**
 * AI agent tools for weekly training programming.
 *
 * - getWeekPlanDetailsTool: retrieves current week plan with resolved exercise names
 * - deleteWeekPlanTool: deletes the current week plan and its draft workouts
 * - getWorkoutPerformanceTool: PR / plateau / volume summary for a movement
 * - approveWeekPlanTool: pushes all draft day workouts to Tonal
 *
 * programWeekTool lives in `./programWeekTool.ts` (split for file-size budget).
 */

import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { DAY_NAMES } from "../coach/weekProgrammingHelpers";
import type { WorkoutPerformanceSummary } from "../coach/prDetection";
import type { WeekPushResult } from "../coach/pushAndVerify";
import type { Movement } from "../tonal/types";
import type { PushDivergence } from "../tonal/mutations";
import { getWeekStartDateString } from "../weekPlanHelpers";
import { requireUserId, withToolTracking } from "./helpers";
import { type DayDivergence, formatPushDivergenceNote } from "./divergenceNote";

// ---------------------------------------------------------------------------
// getWeekPlanDetailsTool
// ---------------------------------------------------------------------------

type WorkoutBlocks = {
  exercises?: { movementId?: string; sets?: number; reps?: number; duration?: number }[];
}[];

interface ExerciseDetail {
  movementId: string;
  name: string;
  muscleGroups: string[];
  sets: number;
  reps?: number;
  durationSeconds?: number;
}

function resolveExercises(
  blocks: WorkoutBlocks,
  movementMap: Map<string, Movement>,
): ExerciseDetail[] {
  const exercises: ExerciseDetail[] = [];
  for (const block of blocks) {
    for (const ex of block.exercises ?? []) {
      if (!ex.movementId) continue;
      const movement = movementMap.get(ex.movementId);
      const isDurationBased = movement ? !movement.countReps : false;
      exercises.push({
        movementId: ex.movementId,
        name: movement?.name ?? ex.movementId,
        muscleGroups: movement?.muscleGroups ?? [],
        sets: ex.sets ?? 3,
        ...(isDurationBased ? { durationSeconds: ex.duration ?? 30 } : { reps: ex.reps ?? 10 }),
      });
    }
  }
  return exercises;
}

interface WeekPlanDayDetail {
  dayIndex: number;
  dayName: string;
  sessionType: string;
  status: string;
  estimatedDuration?: number;
  exercises: {
    movementId: string;
    name: string;
    muscleGroups: string[];
    sets: number;
    reps?: number;
    durationSeconds?: number;
  }[];
}

interface WeekPlanDetails {
  weekStartDate: string;
  preferredSplit: string;
  targetDays: number;
  days: WeekPlanDayDetail[];
}

export const getWeekPlanDetailsTool = createTool({
  description:
    "Retrieve the current week's training plan with full exercise details (names, muscle groups, sets, reps, push status). Use this to show the user their plan or to check what's already programmed before making changes.",
  inputSchema: z.object({}),
  execute: withToolTracking(
    "get_week_plan_details",
    async (
      ctx,
      _input,
      _options,
    ): Promise<{ found: true; plan: WeekPlanDetails } | { found: false; message: string }> => {
      const userId = requireUserId(ctx);
      const weekStartDate = getWeekStartDateString(new Date());

      const weekPlan = (await ctx.runQuery(internal.weekPlans.getByUserIdAndWeekStartInternal, {
        userId,
        weekStartDate,
      })) as {
        _id: Id<"weekPlans">;
        weekStartDate: string;
        preferredSplit: string;
        targetDays: number;
        days: {
          sessionType: string;
          status: string;
          workoutPlanId?: Id<"workoutPlans">;
          estimatedDuration?: number;
        }[];
      } | null;

      if (!weekPlan) {
        return { found: false, message: "No week plan found for the current week." };
      }

      // Load movement catalog for name resolution
      const catalog: Movement[] = await ctx.runQuery(internal.tonal.movementSync.getAllMovements);
      const movementMap = new Map(catalog.map((m) => [m.id, m]));

      // Resolve each day's workout details
      const dayDetails: WeekPlanDayDetail[] = [];

      for (let i = 0; i < weekPlan.days.length; i++) {
        const day = weekPlan.days[i];
        const detail: WeekPlanDayDetail = {
          dayIndex: i,
          dayName: DAY_NAMES[i],
          sessionType: day.sessionType,
          status: day.status,
          estimatedDuration: day.estimatedDuration,
          exercises: [],
        };

        if (day.workoutPlanId) {
          const plan = (await ctx.runQuery(internal.workoutPlans.getById, {
            planId: day.workoutPlanId,
            userId,
          })) as { blocks: WorkoutBlocks } | null;

          if (plan?.blocks) {
            detail.exercises = resolveExercises(plan.blocks, movementMap);
          }
        }

        dayDetails.push(detail);
      }

      return {
        found: true,
        plan: {
          weekStartDate: weekPlan.weekStartDate,
          preferredSplit: weekPlan.preferredSplit,
          targetDays: weekPlan.targetDays,
          days: dayDetails,
        },
      };
    },
  ),
});

// ---------------------------------------------------------------------------
// deleteWeekPlanTool
// ---------------------------------------------------------------------------

export const deleteWeekPlanTool = createTool({
  description:
    "Delete the current week's training plan and all its draft workouts. Use this when the user wants to start over or discard the current plan.",
  inputSchema: z.object({}),
  execute: withToolTracking(
    "delete_week_plan",
    async (
      ctx,
      _input,
      _options,
    ): Promise<{ deleted: true } | { deleted: false; message: string }> => {
      const userId = requireUserId(ctx);
      const weekStartDate = getWeekStartDateString(new Date());

      const weekPlan = (await ctx.runQuery(internal.weekPlans.getByUserIdAndWeekStartInternal, {
        userId,
        weekStartDate,
      })) as { _id: Id<"weekPlans"> } | null;

      if (!weekPlan) {
        return { deleted: false, message: "No week plan found for the current week." };
      }

      await ctx.runMutation(internal.weekPlans.deleteWeekPlanInternal, {
        userId,
        weekPlanId: weekPlan._id,
      });

      return { deleted: true };
    },
  ),
});

// ---------------------------------------------------------------------------
// getWorkoutPerformanceTool
// ---------------------------------------------------------------------------

export const getWorkoutPerformanceTool = createTool({
  description:
    "Get performance summary for the user's recent training. Shows PRs (personal records), plateaus, regressions, and progression trends per exercise. Use this when the user asks about their progress, after they complete a workout, or when you want to acknowledge their recent performance.",
  inputSchema: z.object({}),
  execute: withToolTracking(
    "get_workout_performance",
    async (ctx, _input, _options): Promise<WorkoutPerformanceSummary> => {
      const userId = requireUserId(ctx);
      const result = (await ctx.runAction(
        internal.progressiveOverload.getWorkoutPerformanceSummary,
        { userId },
      )) as WorkoutPerformanceSummary;
      return result;
    },
  ),
});

// ---------------------------------------------------------------------------
// approveWeekPlanTool
// ---------------------------------------------------------------------------

export const approveWeekPlanTool = createTool({
  description:
    "Push all draft workouts in the current week plan to Tonal. Use after the user verbally approves the plan in chat. Reports per-workout push status.",
  inputSchema: z.object({}),
  execute: withToolTracking(
    "approve_week_plan",
    async (
      ctx,
      _input,
      _options,
    ): Promise<(WeekPushResult & { divergenceNote?: string }) | { error: string }> => {
      const userId = requireUserId(ctx);
      const weekStartDate = getWeekStartDateString(new Date());

      const plan = (await ctx.runQuery(internal.weekPlans.getByUserIdAndWeekStartInternal, {
        userId,
        weekStartDate,
      })) as { _id: Id<"weekPlans"> } | null;

      if (!plan) {
        return { error: "No week plan found. Use program_week first." };
      }

      const result = (await ctx.runAction(internal.coach.pushAndVerify.pushWeekPlanToTonal, {
        userId,
        weekPlanId: plan._id,
      })) as WeekPushResult;

      // Aggregate per-day divergence and surface to LLM.
      const dayDivergences: DayDivergence[] = result.results
        .filter(
          (r): r is typeof r & { pushDivergence: PushDivergence } =>
            r.status === "pushed" &&
            r.pushDivergence != null &&
            (r.pushDivergence.missingMovements.length > 0 ||
              r.pushDivergence.extraMovements.length > 0 ||
              r.pushDivergence.setCountMismatches.length > 0),
        )
        .map((r) => ({ dayName: r.dayName, divergence: r.pushDivergence }));

      const divergenceNote = formatPushDivergenceNote(dayDivergences);
      if (divergenceNote) {
        return { ...result, divergenceNote };
      }

      return result;
    },
  ),
});
