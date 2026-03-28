/**
 * AI agent tools for weekly training programming.
 *
 * - programWeekTool: generates a draft week plan (no Tonal push)
 * - getWeekPlanDetailsTool: retrieves current week plan with resolved exercise names
 * - deleteWeekPlanTool: deletes the current week plan and its draft workouts
 */

import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { DraftWeekSummary } from "../coach/weekProgrammingHelpers";
import { DAY_NAMES } from "../coach/weekProgrammingHelpers";
import type { WorkoutPerformanceSummary } from "../coach/prDetection";
import type { WeekPushResult } from "../coach/pushAndVerify";
import type { Movement } from "../tonal/types";
import { getWeekStartDateString } from "../weekPlanHelpers";
import { requireUserId, withToolTracking } from "./helpers";
import { buildReasoningPrompt } from "./weekReasoning";

// ---------------------------------------------------------------------------
// programWeekTool
// ---------------------------------------------------------------------------

export const programWeekTool = createTool({
  description: `Program the user's full training week. Creates draft workouts for each training day based on their split, available days, and session duration. Returns a summary of the full week plan with exercises, sets, reps, and progressive overload targets. The plan is NOT pushed to Tonal yet — present it to the user for approval first, then use approve_week_plan. If the user already has saved preferences, you can omit the parameters to use their saved preferences.`,
  inputSchema: z.object({
    preferredSplit: z
      .enum(["ppl", "upper_lower", "full_body"])
      .optional()
      .describe(
        "Training split. ppl = Push/Pull/Legs, upper_lower = Upper/Lower, full_body = Full Body. Omit to use saved preferences.",
      ),
    trainingDays: z
      .array(z.number().int().min(0).max(6))
      .optional()
      .describe(
        "Day indices: 0=Monday, 1=Tuesday, ..., 6=Sunday. Omit to auto-space based on count.",
      ),
    targetDays: z
      .number()
      .int()
      .min(1)
      .max(7)
      .optional()
      .describe("Number of training days per week (used if trainingDays is omitted)."),
    sessionDurationMinutes: z
      .enum(["30", "45", "60"])
      .optional()
      .describe("Session duration. Omit to use saved preferences."),
  }),
  execute: withToolTracking(
    "program_week",
    async (
      ctx,
      input,
      _options,
    ): Promise<
      | {
          success: true;
          weekPlanId: string;
          summary: DraftWeekSummary;
          reasoningHints: string;
        }
      | { success: false; error: string }
    > => {
      const userId = requireUserId(ctx);

      // Load saved preferences as defaults
      const saved = (await ctx.runQuery(internal.userProfiles.getTrainingPreferencesInternal, {
        userId,
      })) as {
        preferredSplit?: "ppl" | "upper_lower" | "full_body";
        trainingDays?: number[];
        sessionDurationMinutes?: number;
      } | null;

      const preferredSplit = input.preferredSplit ?? saved?.preferredSplit ?? "ppl";
      const sessionDuration = input.sessionDurationMinutes
        ? (parseInt(input.sessionDurationMinutes) as 30 | 45 | 60)
        : ((saved?.sessionDurationMinutes as 30 | 45 | 60 | undefined) ?? 45);

      const targetDays =
        input.trainingDays?.length ?? input.targetDays ?? saved?.trainingDays?.length ?? 3;

      const result = (await ctx.runAction(internal.coach.weekProgramming.generateDraftWeekPlan, {
        userId,
        weekStartDate: getWeekStartDateString(new Date()),
        preferredSplit,
        targetDays,
        sessionDurationMinutes: sessionDuration,
        trainingDayIndicesOverride: input.trainingDays ?? saved?.trainingDays,
      })) as
        | { success: true; weekPlanId: Id<"weekPlans">; summary: DraftWeekSummary }
        | { success: false; error: string };

      if (!result.success) return result;

      // Build lightweight reasoning hints from data already in scope.
      // The AI agent has the full training snapshot (muscle readiness,
      // injuries, feedback) in its context — no need to duplicate here.
      const reasoningHints = buildReasoningPrompt({
        split: preferredSplit,
        targetDays,
        sessionDuration,
        muscleReadiness: {},
        recentWorkouts: [],
        activeInjuries: [],
        recentFeedback: null,
        isDeload: false,
      });

      return { ...result, reasoningHints };
    },
  ),
});

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
// approveWeekPlanTool
// ---------------------------------------------------------------------------

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
    async (ctx, _input, _options): Promise<WeekPushResult | { error: string }> => {
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

      return result;
    },
  ),
});
