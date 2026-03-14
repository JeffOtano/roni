/**
 * Program my week: create week plan, build workouts per session type, push to Tonal, link days.
 * Single internal action used by the AI coach tool and dashboard CTA.
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
  blocksFromMovementIds,
  DAY_NAMES,
  DEFAULT_MAX_EXERCISES,
  formatSessionTitle,
  getSessionTypesForSplit,
  getTrainingDayIndices,
  parseUserLevel,
  SESSION_DURATION_TO_MAX_EXERCISES,
  SESSION_TYPE_MUSCLES,
} from "./weekProgrammingHelpers";
import type { DraftDaySummary, DraftWeekSummary, SessionType } from "./weekProgrammingHelpers";

export type { DraftWeekSummary } from "./weekProgrammingHelpers";

// ---------------------------------------------------------------------------
// Shared helpers
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
      sessionDurationMinutes: number;
      weekStartDate: string;
      userId: Id<"users">;
    };

async function fetchAndComputePlanData(
  ctx: ActionCtx,
  userId: Id<"users">,
  preferredSplit: "ppl" | "upper_lower" | "full_body",
  targetDays: number,
): Promise<{
  catalog: Movement[];
  lastUsedMovementIds: string[];
  userLevel: number;
  daySessions: { dayIndex: number; sessionType: SessionType }[];
  initialDays: { sessionType: SessionType | "rest"; status: "programmed" }[];
}> {
  const [profile, catalog, lastUsedMovementIds] = await Promise.all([
    ctx.runQuery(internal.userProfiles.getByUserId, { userId }),
    ctx.runAction(internal.tonal.proxy.fetchMovements, { userId }),
    ctx.runQuery(internal.workoutPlans.getRecentMovementIds, { userId }),
  ]);
  const userLevel = parseUserLevel(profile?.profileData?.level);
  const trainingDayIndices = getTrainingDayIndices(targetDays);
  const daySessions = getSessionTypesForSplit(preferredSplit, trainingDayIndices);
  const sessionTypeByDay = new Map(daySessions.map((d) => [d.dayIndex, d.sessionType]));
  const initialDays = Array.from({ length: 7 }, (_, i) => ({
    sessionType: (sessionTypeByDay.get(i) ?? "rest") as SessionType | "rest",
    status: "programmed" as const,
  }));
  return {
    catalog: catalog as Movement[],
    lastUsedMovementIds: lastUsedMovementIds as string[],
    userLevel,
    daySessions,
    initialDays,
  };
}

// ---------------------------------------------------------------------------
// programWeek — existing pipeline (creates + pushes to Tonal)
// ---------------------------------------------------------------------------

async function createPlanPhase(
  ctx: ActionCtx,
  args: {
    userId: Id<"users">;
    weekStartDate?: string;
    preferredSplit?: "ppl" | "upper_lower" | "full_body";
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
    sessionDurationMinutes,
    weekStartDate,
    userId: args.userId,
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
    sessionDurationMinutes,
    weekStartDate,
    userId,
  } = plan;

  for (const { dayIndex, sessionType } of daySessions) {
    const targetMuscleGroups = SESSION_TYPE_MUSCLES[sessionType] ?? SESSION_TYPE_MUSCLES.full_body;
    const movementIds = selectExercises({
      catalog,
      targetMuscleGroups,
      userLevel,
      maxExercises,
      lastUsedMovementIds,
    });
    if (movementIds.length === 0) continue;

    let suggestions: { movementId: string; suggestedReps?: number }[] = [];
    try {
      suggestions = (await ctx.runAction(
        internal.progressiveOverload.getLastTimeAndSuggestedInternal,
        { userId, movementIds },
      )) as { movementId: string; suggestedReps?: number }[];
    } catch {
      // No history or Tonal unavailable; use default reps.
    }

    const blocks = blocksFromMovementIds(movementIds, suggestions);
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

// ---------------------------------------------------------------------------
// generateDraftWeekPlan — draft pipeline (no Tonal push, returns rich summary)
// ---------------------------------------------------------------------------

export const generateDraftWeekPlan = internalAction({
  args: {
    userId: v.id("users"),
    weekStartDate: v.optional(v.string()),
    preferredSplit: v.optional(preferredSplitValidator),
    targetDays: v.optional(v.number()),
    sessionDurationMinutes: v.optional(v.union(v.literal(30), v.literal(45), v.literal(60))),
    trainingDayIndicesOverride: v.optional(v.array(v.number())),
  },
  handler: async (
    ctx,
    args,
  ): Promise<
    | { success: true; weekPlanId: Id<"weekPlans">; summary: DraftWeekSummary }
    | { success: false; error: string }
  > => {
    const weekStartDate = args.weekStartDate ?? getWeekStartDateString(new Date());
    if (!isValidWeekStartDateString(weekStartDate)) {
      return { success: false, error: "weekStartDate must be YYYY-MM-DD (Monday)." };
    }

    const preferredSplit = args.preferredSplit ?? "ppl";
    const targetDays = Math.min(7, Math.max(1, args.targetDays ?? 3));
    const sessionDurationMinutes = args.sessionDurationMinutes ?? 45;
    const maxExercises =
      SESSION_DURATION_TO_MAX_EXERCISES[sessionDurationMinutes] ?? DEFAULT_MAX_EXERCISES;

    // Delete existing plan for this week if present (user is re-generating)
    const existing = await ctx.runQuery(internal.weekPlans.getByUserIdAndWeekStartInternal, {
      userId: args.userId,
      weekStartDate,
    });
    if (existing) {
      await ctx.runMutation(internal.weekPlans.deleteWeekPlanInternal, {
        userId: args.userId,
        weekPlanId: existing._id,
      });
    }

    const data = await fetchAndComputePlanData(ctx, args.userId, preferredSplit, targetDays);

    // If user specified exact day indices, override the computed ones
    const daySessions = args.trainingDayIndicesOverride
      ? getSessionTypesForSplit(preferredSplit, args.trainingDayIndicesOverride)
      : data.daySessions;

    // Rebuild initialDays with the potentially overridden day sessions
    const sessionTypeByDay = new Map(daySessions.map((d) => [d.dayIndex, d.sessionType]));
    const initialDays = Array.from({ length: 7 }, (_, i) => ({
      sessionType: (sessionTypeByDay.get(i) ?? "rest") as SessionType | "rest",
      status: "programmed" as const,
    }));

    const weekPlanId = (await ctx.runMutation(internal.weekPlans.createForUserInternal, {
      userId: args.userId,
      weekStartDate,
      preferredSplit,
      targetDays,
      days: initialDays,
    })) as Id<"weekPlans">;

    // Build drafts for each training day (sequential to avoid movement reuse)
    const daySummaries: DraftDaySummary[] = [];
    const catalog = data.catalog;

    for (const { dayIndex, sessionType } of daySessions) {
      const targetMuscleGroups =
        SESSION_TYPE_MUSCLES[sessionType] ?? SESSION_TYPE_MUSCLES.full_body;
      const movementIds = selectExercises({
        catalog,
        targetMuscleGroups,
        userLevel: data.userLevel,
        maxExercises,
        lastUsedMovementIds: data.lastUsedMovementIds,
      });
      if (movementIds.length === 0) continue;

      // Progressive overload suggestions
      let suggestions: {
        movementId: string;
        suggestedReps?: number;
        lastTimeText?: string;
        suggestedText?: string;
      }[] = [];
      try {
        suggestions = (await ctx.runAction(
          internal.progressiveOverload.getLastTimeAndSuggestedInternal,
          { userId: args.userId, movementIds },
        )) as typeof suggestions;
      } catch {
        // No history; use defaults.
      }

      const blocks = blocksFromMovementIds(movementIds, suggestions);
      const title = formatSessionTitle(sessionType, weekStartDate, dayIndex);

      // Create draft (no Tonal push)
      const planId = (await ctx.runMutation(internal.weekPlans.createDraftWorkoutInternal, {
        userId: args.userId,
        title,
        blocks,
        estimatedDuration: sessionDurationMinutes,
      })) as Id<"workoutPlans">;

      // Link to week plan
      await ctx.runMutation(internal.weekPlans.linkWorkoutPlanToDayInternal, {
        userId: args.userId,
        weekPlanId,
        dayIndex,
        workoutPlanId: planId,
        estimatedDuration: sessionDurationMinutes,
      });

      // Build summary for agent display
      const exerciseSummaries = movementIds.map((mid) => {
        const movement = catalog.find((m) => m.id === mid);
        const suggestion = suggestions.find((s) => s.movementId === mid);
        const block = blocks[0]?.exercises.find((e) => e.movementId === mid);
        return {
          movementId: mid,
          name: movement?.name ?? mid,
          muscleGroups: movement?.muscleGroups ?? [],
          sets: block?.sets ?? 3,
          reps: block?.reps ?? 10,
          lastTime: suggestion?.lastTimeText,
          suggestedTarget: suggestion?.suggestedText,
        };
      });

      daySummaries.push({
        dayIndex,
        dayName: DAY_NAMES[dayIndex],
        sessionType,
        workoutPlanId: planId,
        estimatedDuration: sessionDurationMinutes,
        exercises: exerciseSummaries,
      });
    }

    // Save preferences for next time
    await ctx.runMutation(internal.userProfiles.saveTrainingPreferencesInternal, {
      userId: args.userId,
      preferredSplit,
      trainingDays: daySessions.map((d) => d.dayIndex),
      sessionDurationMinutes,
    });

    return {
      success: true,
      weekPlanId,
      summary: {
        weekStartDate,
        preferredSplit,
        targetDays,
        sessionDurationMinutes,
        days: daySummaries,
      },
    };
  },
});
