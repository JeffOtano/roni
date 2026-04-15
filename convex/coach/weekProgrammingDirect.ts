/**
 * Direct week programming pipeline: creates week plan + pushes workouts directly to Tonal.
 * The draft pipeline (generateDraftWeekPlan) in weekProgramming.ts creates drafts for review instead.
 */

import { v } from "convex/values";
import type { ActionCtx } from "../_generated/server";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import {
  getWeekStartDateString,
  isValidWeekStartDateString,
  preferredSplitValidator,
} from "../weekPlans";
import { selectExercises } from "./exerciseSelection";
import type { Movement } from "../tonal/types";
import {
  DEFAULT_MAX_EXERCISES,
  SESSION_DURATION_TO_MAX_EXERCISES,
  SESSION_TYPE_MUSCLES,
} from "./weekProgrammingHelpers";
import { blocksFromMovementIds } from "./workoutBlocks";
import type { SessionType } from "./weekProgrammingHelpers";
import { fetchAndComputePlanData } from "./weekProgramming";
import type { RepSetScheme } from "./goalConfig";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CreatePlanResult =
  | { error: string }
  | {
      weekPlanId: Id<"weekPlans">;
      daySessions: { dayIndex: number; sessionType: SessionType }[];
      catalog: Movement[];
      userLevel: number;
      maxExercises: number;
      lastUsedMovementIds: string[];
      constraints: { excludeNameSubstrings?: string[]; excludeAccessories?: string[] };
      sessionDurationMinutes: number;
      weekStartDate: string;
      userId: Id<"users">;
      goalScheme: RepSetScheme;
    };

// ---------------------------------------------------------------------------
// Phase helpers
// ---------------------------------------------------------------------------

async function createPlanPhase(
  ctx: ActionCtx,
  args: {
    userId: Id<"users">;
    weekStartDate?: string;
    preferredSplit?: "ppl" | "upper_lower" | "full_body" | "bro_split";
    targetDays?: number;
    sessionDurationMinutes?: 30 | 45 | 60;
  },
): Promise<CreatePlanResult> {
  const weekStartDate = args.weekStartDate ?? getWeekStartDateString(new Date());
  if (!isValidWeekStartDateString(weekStartDate)) {
    return { error: "weekStartDate must be YYYY-MM-DD (Monday of the week)." };
  }

  const preferredSplit = args.preferredSplit ?? "ppl";
  const targetDays = Math.min(7, Math.max(1, args.targetDays ?? 3));
  const sessionDurationMinutes = args.sessionDurationMinutes ?? 45;
  const maxExercises =
    SESSION_DURATION_TO_MAX_EXERCISES[sessionDurationMinutes] ?? DEFAULT_MAX_EXERCISES;

  const existing = await ctx.runQuery(internal.weekPlans.getByUserIdAndWeekStartInternal, {
    userId: args.userId,
    weekStartDate,
  });
  if (existing) {
    return {
      error: `Week plan already exists for ${weekStartDate}. Use update or a different week.`,
    };
  }

  const data = await fetchAndComputePlanData(ctx, args.userId, preferredSplit, targetDays);
  const weekPlanId = (await ctx.runMutation(internal.weekPlans.createForUserInternal, {
    userId: args.userId,
    weekStartDate,
    preferredSplit,
    targetDays,
    days: data.initialDays,
  })) as Id<"weekPlans">;

  return {
    weekPlanId,
    daySessions: data.daySessions,
    catalog: data.catalog,
    userLevel: data.userLevel,
    maxExercises,
    lastUsedMovementIds: data.lastUsedMovementIds,
    constraints: data.constraints ?? {},
    sessionDurationMinutes,
    weekStartDate,
    userId: args.userId,
    goalScheme: data.goalScheme,
  };
}

async function fillWorkoutsPhase(
  ctx: ActionCtx,
  plan: Exclude<CreatePlanResult, { error: string }>,
): Promise<void> {
  const {
    weekPlanId,
    daySessions,
    catalog,
    userLevel,
    maxExercises,
    lastUsedMovementIds,
    constraints,
    sessionDurationMinutes,
    weekStartDate,
    userId,
    goalScheme,
  } = plan;

  for (const { dayIndex, sessionType } of daySessions) {
    const targetMuscleGroups = SESSION_TYPE_MUSCLES[sessionType] ?? SESSION_TYPE_MUSCLES.full_body;
    const movementIds = selectExercises({
      catalog,
      targetMuscleGroups,
      userLevel,
      maxExercises,
      lastUsedMovementIds,
      constraints,
    });
    if (movementIds.length === 0) continue;

    let suggestions: { movementId: string; suggestedReps?: number }[] = [];
    try {
      suggestions = (await ctx.runAction(
        internal.progressiveOverload.getLastTimeAndSuggestedInternal,
        { userId, movementIds },
      )) as { movementId: string; suggestedReps?: number }[];
    } catch (error) {
      console.error("[weekProgrammingDirect] Progressive overload lookup failed", error);
      void ctx.runAction(internal.discord.notifyError, {
        source: "weekProgrammingDirect",
        message: `Progressive overload failed: ${error instanceof Error ? error.message : String(error)}`,
        userId,
      });
    }

    const blocks = blocksFromMovementIds(movementIds, suggestions, {
      catalog,
      goalScheme,
    });
    const title = `${sessionType.replaceAll("_", " ")} – ${weekStartDate} day ${dayIndex + 1}`;
    const result = (await ctx.runAction(internal.tonal.mutations.createWorkout, {
      userId,
      title,
      blocks,
    })) as { success: boolean; planId?: Id<"workoutPlans"> };
    if (result.success && result.planId) {
      await ctx.runMutation(internal.weekPlans.linkWorkoutPlanToDayInternal, {
        userId,
        weekPlanId,
        dayIndex,
        workoutPlanId: result.planId,
        estimatedDuration: sessionDurationMinutes,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// programWeek — existing pipeline (creates + pushes to Tonal)
// ---------------------------------------------------------------------------

export const programWeek = internalAction({
  args: {
    userId: v.id("users"),
    weekStartDate: v.optional(v.string()),
    preferredSplit: v.optional(preferredSplitValidator),
    targetDays: v.optional(v.number()),
    sessionDurationMinutes: v.optional(v.union(v.literal(30), v.literal(45), v.literal(60))),
  },
  handler: async (
    ctx,
    args,
  ): Promise<
    { success: true; weekPlanId: Id<"weekPlans"> } | { success: false; error: string }
  > => {
    const plan = await createPlanPhase(ctx, args);
    if ("error" in plan) return { success: false, error: plan.error };
    await fillWorkoutsPhase(ctx, plan);
    return { success: true, weekPlanId: plan.weekPlanId };
  },
});
