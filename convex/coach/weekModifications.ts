/**
 * Week plan modification mutations/actions.
 *
 * - swapExerciseInDraft: replace a movementId in a draft workout's blocks
 * - swapDaySlots: swap two day entries in a week plan
 * - adjustDayDuration: re-generate exercises for a day with a new duration
 */

import { v } from "convex/values";
import { internalAction, internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { Movement } from "../tonal/types";
import { selectExercises } from "./exerciseSelection";
import { computeExcludedAccessories } from "../tonal/accessories";
import {
  blocksFromMovementIds,
  DEFAULT_MAX_EXERCISES,
  formatSessionTitle,
  parseUserLevel,
  SESSION_DURATION_TO_MAX_EXERCISES,
  SESSION_TYPE_MUSCLES,
} from "./weekProgrammingHelpers";
import type { SessionType } from "./weekProgrammingHelpers";

// ---------------------------------------------------------------------------
// swapExerciseInDraft
// ---------------------------------------------------------------------------

/** Replace a movementId in a draft workout's blocks. */
export const swapExerciseInDraft = internalMutation({
  args: {
    userId: v.id("users"),
    workoutPlanId: v.id("workoutPlans"),
    oldMovementId: v.string(),
    newMovementId: v.string(),
  },
  handler: async (ctx, { userId, workoutPlanId, oldMovementId, newMovementId }) => {
    const wp = await ctx.db.get(workoutPlanId);
    if (!wp || wp.userId !== userId) {
      throw new Error("Workout plan not found or access denied");
    }
    if (wp.status !== "draft") {
      throw new Error("Can only swap exercises in draft workout plans");
    }

    // Validate the new movement ID exists in the catalog
    const movement = await ctx.db
      .query("movements")
      .withIndex("by_tonalId", (q) => q.eq("tonalId", newMovementId))
      .first();
    if (!movement) {
      throw new Error(
        `Invalid movementId: ${newMovementId}. Use search_exercises to get valid IDs from the catalog.`,
      );
    }

    const blocks = wp.blocks;
    const updatedBlocks = blocks.map((block) => ({
      ...block,
      exercises: block.exercises.map((ex) =>
        ex.movementId === oldMovementId ? { ...ex, movementId: newMovementId } : ex,
      ),
    }));

    await ctx.db.patch(workoutPlanId, { blocks: updatedBlocks });
  },
});

// ---------------------------------------------------------------------------
// addExerciseToDraft
// ---------------------------------------------------------------------------

/** Add an exercise to a draft workout. Appends to the last main block or creates a new block. */
export const addExerciseToDraft = internalMutation({
  args: {
    userId: v.id("users"),
    workoutPlanId: v.id("workoutPlans"),
    movementId: v.string(),
    sets: v.number(),
    reps: v.optional(v.number()),
    duration: v.optional(v.number()),
    warmUp: v.optional(v.boolean()),
    eccentric: v.optional(v.boolean()),
    spotter: v.optional(v.boolean()),
    chains: v.optional(v.boolean()),
    burnout: v.optional(v.boolean()),
    dropSet: v.optional(v.boolean()),
  },
  handler: async (ctx, { userId, workoutPlanId, movementId, sets, ...opts }) => {
    const wp = await ctx.db.get(workoutPlanId);
    if (!wp || wp.userId !== userId) {
      throw new Error("Workout plan not found or access denied");
    }
    if (wp.status !== "draft") {
      throw new Error("Can only add exercises to draft workout plans");
    }

    // Validate the movement ID exists in the catalog
    const movement = await ctx.db
      .query("movements")
      .withIndex("by_tonalId", (q) => q.eq("tonalId", movementId))
      .first();
    if (!movement) {
      throw new Error(
        `Invalid movementId: ${movementId}. Use search_exercises to get valid IDs from the catalog.`,
      );
    }

    const blocks = [...wp.blocks];
    const newExercise = { movementId, sets, ...opts };

    // Find the last non-cooldown block. Cooldown is always the last block
    // and warmup is always the first. Insert before cooldown.
    if (blocks.length <= 1) {
      // Only warmup or empty — add as a new block
      blocks.push({ exercises: [newExercise] });
    } else {
      // Insert a new single-exercise block before the cooldown (last block)
      const cooldownIdx = blocks.length - 1;
      blocks.splice(cooldownIdx, 0, { exercises: [newExercise] });
    }

    await ctx.db.patch(workoutPlanId, { blocks });
  },
});

// ---------------------------------------------------------------------------
// swapDaySlots
// ---------------------------------------------------------------------------

/** Swap two day slots in a week plan. */
export const swapDaySlots = internalMutation({
  args: {
    userId: v.id("users"),
    weekPlanId: v.id("weekPlans"),
    fromDayIndex: v.number(),
    toDayIndex: v.number(),
  },
  handler: async (ctx, { userId, weekPlanId, fromDayIndex, toDayIndex }) => {
    if (fromDayIndex < 0 || fromDayIndex > 6 || toDayIndex < 0 || toDayIndex > 6) {
      throw new Error("Day indices must be 0 (Monday) through 6 (Sunday)");
    }
    if (fromDayIndex === toDayIndex) return;

    const plan = await ctx.db.get(weekPlanId);
    if (!plan || plan.userId !== userId) {
      throw new Error("Week plan not found or access denied");
    }

    const days = [...plan.days];
    const temp = days[fromDayIndex];
    days[fromDayIndex] = days[toDayIndex];
    days[toDayIndex] = temp;

    await ctx.db.patch(weekPlanId, { days, updatedAt: Date.now() });
  },
});

// ---------------------------------------------------------------------------
// adjustDayDuration
// ---------------------------------------------------------------------------

/** Re-generate exercises for a specific day with a new duration. */
export const adjustDayDuration = internalAction({
  args: {
    userId: v.id("users"),
    weekPlanId: v.id("weekPlans"),
    dayIndex: v.number(),
    newDurationMinutes: v.union(v.literal(30), v.literal(45), v.literal(60)),
  },
  handler: async (ctx, { userId, weekPlanId, dayIndex, newDurationMinutes }) => {
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

    const rawSessionType = day.sessionType as string;
    if (rawSessionType === "rest" || rawSessionType === "recovery") {
      throw new Error("Cannot adjust duration of a rest or recovery day");
    }
    const sessionType = rawSessionType as SessionType;

    const targetMuscleGroups = SESSION_TYPE_MUSCLES[sessionType] ?? SESSION_TYPE_MUSCLES.full_body;
    const maxExercises =
      SESSION_DURATION_TO_MAX_EXERCISES[newDurationMinutes] ?? DEFAULT_MAX_EXERCISES;

    // Fetch catalog, recent movement IDs, user profile, and active injuries in parallel
    const [catalog, lastUsedMovementIds, profile, activeInjuries]: [
      Movement[],
      string[],
      Doc<"userProfiles"> | null,
      Doc<"injuries">[],
    ] = await Promise.all([
      ctx.runQuery(internal.tonal.movementSync.getAllMovements),
      ctx.runQuery(internal.workoutPlans.getRecentMovementIds, { userId }),
      ctx.runQuery(internal.userProfiles.getByUserId, { userId }),
      ctx.runQuery(internal.injuries.getActiveInternal, { userId }),
    ]);

    const userLevel = parseUserLevel(
      (profile as { profileData?: { level?: string } } | null)?.profileData?.level,
    );

    // Build constraints from injuries and equipment
    const injuryAvoidances = activeInjuries
      .flatMap((inj) => inj.avoidance.split(",").map((s) => s.trim()))
      .filter((s) => s.length > 0);
    const excludeAccessories = computeExcludedAccessories(profile?.ownedAccessories ?? undefined);

    const movementIds = selectExercises({
      catalog,
      targetMuscleGroups,
      userLevel,
      maxExercises,
      lastUsedMovementIds: lastUsedMovementIds as string[],
      constraints: {
        excludeNameSubstrings: injuryAvoidances.length > 0 ? injuryAvoidances : undefined,
        excludeAccessories: excludeAccessories.length > 0 ? excludeAccessories : undefined,
      },
    });

    if (movementIds.length === 0) {
      throw new Error("No eligible exercises found for this session type and duration");
    }

    // Progressive overload suggestions
    let suggestions: { movementId: string; suggestedReps?: number }[] = [];
    try {
      suggestions = (await ctx.runAction(
        internal.progressiveOverload.getLastTimeAndSuggestedInternal,
        { userId, movementIds },
      )) as typeof suggestions;
    } catch (error) {
      console.error("[weekModifications] Progressive overload lookup failed", error);
      void ctx.runAction(internal.discord.notifyError, {
        source: "weekModifications",
        message: `Progressive overload failed during exercise swap: ${error instanceof Error ? error.message : String(error)}`,
        userId,
      });
    }

    const blocks = blocksFromMovementIds(movementIds, suggestions, {
      catalog,
    });
    const title = formatSessionTitle(sessionType, plan.weekStartDate, dayIndex);

    // Delete old draft workout if exists
    if (day.workoutPlanId) {
      await ctx.runMutation(internal.weekPlans.deleteDraftWorkout, {
        workoutPlanId: day.workoutPlanId,
      });
    }

    // Create new draft workout
    const newPlanId = (await ctx.runMutation(internal.weekPlans.createDraftWorkoutInternal, {
      userId,
      title,
      blocks,
      estimatedDuration: newDurationMinutes,
    })) as Id<"workoutPlans">;

    // Link to week plan
    await ctx.runMutation(internal.weekPlans.linkWorkoutPlanToDayInternal, {
      userId,
      weekPlanId,
      dayIndex,
      workoutPlanId: newPlanId,
      estimatedDuration: newDurationMinutes,
    });
  },
});
