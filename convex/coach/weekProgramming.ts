/**
 * Draft week programming pipeline: creates week plan with draft workouts for review.
 * The direct pipeline (programWeek) that pushes directly to Tonal lives in weekProgrammingDirect.ts.
 */

import { v } from "convex/values";
import type { ActionCtx } from "../_generated/server";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import {
  getWeekStartDateString,
  isValidWeekStartDateString,
  preferredSplitValidator,
} from "../weekPlans";
import {
  selectCooldownExercises,
  selectExercises,
  selectWarmupExercises,
} from "./exerciseSelection";
import type { ExerciseSelectionInput } from "./exerciseSelection";
import type { Movement } from "../tonal/types";
import { computeExcludedAccessories } from "../tonal/accessories";
import {
  DAY_NAMES,
  DEFAULT_MAX_EXERCISES,
  DEFAULT_WARMUP_COOLDOWN,
  formatSessionTitle,
  getSessionTypesForSplit,
  getTrainingDayIndices,
  parseUserLevel,
  SESSION_DURATION_TO_MAX_EXERCISES,
  SESSION_TYPE_MUSCLES,
  sortForMinimalEquipmentSwitches,
  WARMUP_COOLDOWN_COUNTS,
} from "./weekProgrammingHelpers";
import {
  blocksFromMovementIds,
  cooldownBlockFromMovementIds,
  warmupBlockFromMovementIds,
} from "./workoutBlocks";
import type { DraftDaySummary, DraftWeekSummary, SessionType } from "./weekProgrammingHelpers";
import { goalStringToRepSetScheme } from "./goalConfig";
import type { RepSetScheme } from "./goalConfig";

export type { DraftWeekSummary } from "./weekProgrammingHelpers";

// ---------------------------------------------------------------------------
// Shared helper (also used by weekProgrammingDirect.ts)
// ---------------------------------------------------------------------------

export async function fetchAndComputePlanData(
  ctx: ActionCtx,
  userId: Id<"users">,
  preferredSplit: "ppl" | "upper_lower" | "full_body" | "bro_split",
  targetDays: number,
): Promise<{
  catalog: Movement[];
  lastUsedMovementIds: string[];
  userLevel: number;
  constraints: ExerciseSelectionInput["constraints"];
  daySessions: { dayIndex: number; sessionType: SessionType }[];
  initialDays: { sessionType: SessionType | "rest"; status: "programmed" }[];
  goalScheme: RepSetScheme;
}> {
  const [profile, catalog, lastUsedMovementIds, activeInjuries]: [
    Doc<"userProfiles"> | null,
    Movement[],
    string[],
    Doc<"injuries">[],
  ] = await Promise.all([
    ctx.runQuery(internal.userProfiles.getByUserId, { userId }),
    ctx.runQuery(internal.tonal.movementSync.getAllMovements),
    ctx.runQuery(internal.workoutPlans.getRecentMovementIds, { userId }),
    ctx.runQuery(internal.injuries.getActiveInternal, { userId }),
  ]);
  const userLevel = parseUserLevel(profile?.profileData?.level);
  const trainingDayIndices = getTrainingDayIndices(targetDays);
  const daySessions = getSessionTypesForSplit(preferredSplit, trainingDayIndices);
  const sessionTypeByDay = new Map(daySessions.map((d) => [d.dayIndex, d.sessionType]));
  const initialDays = Array.from({ length: 7 }, (_, i) => ({
    sessionType: (sessionTypeByDay.get(i) ?? "rest") as SessionType | "rest",
    status: "programmed" as const,
  }));

  // Build constraints from injuries and equipment
  const injuryAvoidances = activeInjuries
    .flatMap((inj) => inj.avoidance.split(",").map((s) => s.trim()))
    .filter((s) => s.length > 0);
  const excludeAccessories = computeExcludedAccessories(profile?.ownedAccessories ?? undefined);

  return {
    catalog,
    lastUsedMovementIds: lastUsedMovementIds as string[],
    userLevel,
    constraints: {
      excludeNameSubstrings: injuryAvoidances.length > 0 ? injuryAvoidances : undefined,
      excludeAccessories: excludeAccessories.length > 0 ? excludeAccessories : undefined,
    },
    daySessions,
    initialDays,
    goalScheme: goalStringToRepSetScheme(profile?.onboardingData?.goal),
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

      // Warmup/cooldown budget subtracted from main exercise count
      const wcCounts = WARMUP_COOLDOWN_COUNTS[sessionDurationMinutes] ?? DEFAULT_WARMUP_COOLDOWN;
      const mainMaxExercises = maxExercises - wcCounts.warmup - wcCounts.cooldown;

      const rawMovementIds = selectExercises({
        catalog,
        targetMuscleGroups,
        userLevel: data.userLevel,
        maxExercises: mainMaxExercises,
        lastUsedMovementIds: data.lastUsedMovementIds,
        constraints: data.constraints,
      });
      if (rawMovementIds.length === 0) continue;

      // Sort exercises to minimize equipment switching and arm adjustments
      const movementIds = sortForMinimalEquipmentSwitches(rawMovementIds, catalog);

      // Select warmup and cooldown exercises
      const accessoryConstraints = { excludeAccessories: data.constraints?.excludeAccessories };
      const warmupIds = selectWarmupExercises({
        catalog,
        targetMuscleGroups,
        maxExercises: wcCounts.warmup,
        constraints: accessoryConstraints,
      });
      const cooldownIds = selectCooldownExercises({
        catalog,
        targetMuscleGroups,
        maxExercises: wcCounts.cooldown,
        constraints: accessoryConstraints,
      });

      // Progressive overload suggestions
      let suggestions: {
        movementId: string;
        suggestedReps?: number;
        lastTimeText?: string;
        suggestedText?: string;
        lastWeightLbs?: number;
        targetWeightLbs?: number;
      }[] = [];
      try {
        suggestions = (await ctx.runAction(
          internal.progressiveOverload.getLastTimeAndSuggestedInternal,
          { userId: args.userId, movementIds },
        )) as typeof suggestions;
      } catch (error) {
        console.error("[weekProgramming] Progressive overload lookup failed", error);
        void ctx.runAction(internal.discord.notifyError, {
          source: "weekProgramming",
          message: `Progressive overload failed for ${sessionType} (day ${dayIndex}): ${error instanceof Error ? error.message : String(error)}`,
          userId: args.userId,
        });
      }

      const warmupBlocks = warmupBlockFromMovementIds(warmupIds, { catalog });
      const mainBlocks = blocksFromMovementIds(movementIds, suggestions, {
        catalog,
        goalScheme: data.goalScheme,
      });
      const cooldownBlocks = cooldownBlockFromMovementIds(cooldownIds, { catalog });
      const blocks = [...warmupBlocks, ...mainBlocks, ...cooldownBlocks];
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
      const allMainExercises = mainBlocks.flatMap((b) => b.exercises);
      const exerciseSummaries = movementIds.map((mid) => {
        const movement = catalog.find((m) => m.id === mid);
        const suggestion = suggestions.find((s) => s.movementId === mid);
        const exercise = allMainExercises.find((e) => e.movementId === mid);
        const isDurationBased = movement ? !movement.countReps : false;
        return {
          movementId: mid,
          name: movement?.name ?? mid,
          muscleGroups: movement?.muscleGroups ?? [],
          sets: exercise?.sets ?? 3,
          ...(isDurationBased
            ? { durationSeconds: exercise?.duration ?? 30 }
            : { reps: exercise?.reps ?? 10 }),
          lastTime: suggestion?.lastTimeText,
          suggestedTarget: suggestion?.suggestedText,
          lastWeight: suggestion?.lastWeightLbs,
          targetWeight: suggestion?.targetWeightLbs,
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
