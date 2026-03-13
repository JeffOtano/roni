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
import type { BlockInput } from "../tonal/transforms";
import type { Movement } from "../tonal/types";

const SESSION_DURATION_TO_MAX_EXERCISES: Record<number, number> = {
  30: 5,
  45: 7,
  60: 9,
};

const DEFAULT_MAX_EXERCISES = 7;

/** Session type to target muscle groups (Tonal names). */
const SESSION_TYPE_MUSCLES: Record<string, string[]> = {
  push: ["Chest", "Triceps", "Shoulders"],
  pull: ["Back", "Biceps"],
  legs: ["Quads", "Glutes", "Hamstrings", "Calves"],
  upper: ["Chest", "Back", "Shoulders", "Triceps", "Biceps"],
  lower: ["Quads", "Glutes", "Hamstrings", "Calves"],
  full_body: [
    "Chest",
    "Back",
    "Shoulders",
    "Triceps",
    "Biceps",
    "Quads",
    "Glutes",
    "Hamstrings",
    "Calves",
  ],
};

type SessionType = "push" | "pull" | "legs" | "upper" | "lower" | "full_body";

/** Training day indices for targetDays (e.g. 3 → Mon/Wed/Fri = 0, 2, 4). Exported for tests. */
export function getTrainingDayIndices(targetDays: number): number[] {
  if (targetDays <= 0 || targetDays > 7) return [];
  const step = targetDays === 7 ? 1 : Math.floor(7 / targetDays);
  const indices: number[] = [];
  for (let i = 0; i < targetDays && indices.length < targetDays; i++) {
    indices.push(Math.min(i * step, 6));
  }
  return [...new Set(indices)].sort((a, b) => a - b);
}

/** Session types for the week for a given split (one per training day in order). Exported for tests. */
export function getSessionTypesForSplit(
  split: "ppl" | "upper_lower" | "full_body",
  trainingDayIndices: number[],
): { dayIndex: number; sessionType: SessionType }[] {
  if (split === "ppl") {
    const types: SessionType[] = ["push", "pull", "legs"];
    return trainingDayIndices.map((dayIndex, i) => ({
      dayIndex,
      sessionType: types[i % 3],
    }));
  }
  if (split === "upper_lower") {
    const types: SessionType[] = ["upper", "lower"];
    return trainingDayIndices.map((dayIndex, i) => ({
      dayIndex,
      sessionType: types[i % 2],
    }));
  }
  return trainingDayIndices.map((dayIndex) => ({
    dayIndex,
    sessionType: "full_body" as SessionType,
  }));
}

function parseUserLevel(level: string | undefined): number {
  if (!level) return 1;
  const l = level.toLowerCase();
  if (l.includes("beginner") || l === "1") return 1;
  if (l.includes("intermediate") || l === "2") return 2;
  if (l.includes("advanced") || l === "3") return 3;
  return 1;
}

const DEFAULT_REPS = 10;

/**
 * Build blocks for Tonal. Optional suggestions from getLastTimeAndSuggested (progressive overload)
 * set reps per movement (e.g. 8 when adding weight, last+1 when adding rep).
 * Tonal blocks accept only movementId, sets, reps (and optional duration/spotter/etc.); suggested
 * weight range (e.g. "72–75 lbs") is not sent to Tonal and is for display only in the app.
 */
function blocksFromMovementIds(
  movementIds: string[],
  suggestions?: { movementId: string; suggestedReps?: number }[],
): BlockInput[] {
  const repsByMovement = new Map<string, number>();
  for (const s of suggestions ?? []) {
    if (s.suggestedReps != null) {
      repsByMovement.set(s.movementId, s.suggestedReps);
    }
  }
  return [
    {
      exercises: movementIds.map((movementId) => ({
        movementId,
        sets: 3,
        reps: repsByMovement.get(movementId) ?? DEFAULT_REPS,
      })),
    },
  ];
}

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
