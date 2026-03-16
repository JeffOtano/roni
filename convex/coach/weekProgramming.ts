/**
 * Draft week programming pipeline: creates week plan with draft workouts for review.
 * The legacy pipeline (programWeek) that pushes directly to Tonal lives in weekProgrammingLegacy.ts.
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
// Shared helper (also used by weekProgrammingLegacy.ts)
// ---------------------------------------------------------------------------

export async function fetchAndComputePlanData(
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

      const blocks = blocksFromMovementIds(movementIds, suggestions, { catalog });
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
