import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { tonalFetch } from "./client";
import { type BlockInput, expandBlocksToSets } from "./transforms";
import { validateWorkoutBlocks } from "./validation";
import type { Activity, WorkoutEstimate } from "./types";
import { cachedFetch } from "./proxy";
import { withTokenRetry } from "./tokenRetry";
import { blockInputValidator } from "../validators";

const DEFAULT_WORKOUT_DURATION_MINUTES = 45;

/** Tonal API only; returns { id }. Used by createWorkout and retryPush. */
export const doTonalCreateWorkout = internalAction({
  args: {
    userId: v.id("users"),
    title: v.string(),
    blocks: blockInputValidator,
  },
  handler: async (ctx, { userId, title, blocks }): Promise<{ id: string }> => {
    const catalog = await ctx.runQuery(internal.tonal.movementSync.getAllMovements);
    const validation = validateWorkoutBlocks(blocks as BlockInput[], catalog);
    if (!validation.valid) {
      throw new Error(
        `Invalid movement IDs. You must use search_exercises to get real IDs from Tonal's catalog. Do not fabricate IDs. Errors: ${validation.errors.join(", ")}`,
      );
    }
    const sets = expandBlocksToSets(blocks as BlockInput[]);

    return withTokenRetry(ctx, userId, async (token) => {
      const workout = await tonalFetch<{ id: string }>(token, "/v6/user-workouts", {
        method: "POST",
        body: { title, sets, createdSource: "WorkoutBuilder" },
      });
      const tonalWorkoutId = workout.id;

      // Soft verification: read back custom workouts list to confirm push
      try {
        const customWorkouts = await tonalFetch<Array<{ id: string }>>(token, `/v6/user-workouts`);
        const verified = customWorkouts?.some((w) => w.id === tonalWorkoutId);
        if (!verified) {
          console.warn(`Push verification: workout ${tonalWorkoutId} not found in read-back`);
        }
      } catch {
        console.warn(`Push verification: could not read back custom workouts list`);
      }

      return { id: tonalWorkoutId };
    });
  },
});

/** Activities for activation eligibility check (separate cache key). */
export const fetchWorkoutHistoryForEligibility = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<Activity[]> =>
    withTokenRetry(ctx, userId, (token, tonalUserId) =>
      cachedFetch<Activity[]>(ctx, {
        userId,
        dataType: "workoutHistoryEligibility",
        ttl: 60 * 5,
        fetcher: () =>
          tonalFetch<Activity[]>(token, `/v6/users/${tonalUserId}/activities?limit=100`),
      }),
    ),
});

export function formatTonalTitle(title: string, now?: Date): string {
  const date = (now ?? new Date()).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${date} · ${title}`;
}

/** Create a custom workout on Tonal and record the plan in Convex. */
export const createWorkout = internalAction({
  args: {
    userId: v.id("users"),
    title: v.string(),
    blocks: blockInputValidator,
    scheduledDate: v.optional(v.string()),
    estimatedDurationMinutes: v.optional(v.number()),
  },
  handler: async (
    ctx,
    { userId, title, blocks, scheduledDate, estimatedDurationMinutes },
  ): Promise<
    | {
        success: true;
        workoutId: string;
        title: string;
        setCount: number;
        planId: Id<"workoutPlans">;
      }
    | { success: false; error: string; planId: Id<"workoutPlans"> }
  > => {
    const sets = expandBlocksToSets(blocks as BlockInput[]);
    try {
      const tonalTitle = title;
      const { id } = await ctx.runAction(internal.tonal.mutations.doTonalCreateWorkout, {
        userId,
        title: tonalTitle,
        blocks,
      });
      const now = Date.now();
      const planId = await ctx.runMutation(internal.workoutPlans.create, {
        userId,
        tonalWorkoutId: id,
        source: "tonal_coach",
        title,
        blocks,
        status: "pushed",
        createdAt: now,
        pushedAt: now,
      });
      await ctx.runMutation(internal.tonal.cache.setCacheEntry, {
        userId,
        dataType: "customWorkouts",
        data: null,
        fetchedAt: 0,
        expiresAt: 0,
      });

      // Schedule calendar event creation (non-blocking)
      const eventDate = scheduledDate ?? new Date().toISOString();
      const durationMinutes = estimatedDurationMinutes ?? DEFAULT_WORKOUT_DURATION_MINUTES;
      await ctx.scheduler.runAfter(0, internal.calendarActions.createCalendarEvent, {
        userId,
        title: tonalTitle,
        date: eventDate,
        durationMinutes: durationMinutes,
        description: `Workout programmed by tonal.coach`,
        workoutPlanId: planId,
      });

      return {
        success: true,
        workoutId: id,
        title,
        setCount: sets.length,
        planId,
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const planId = await ctx.runMutation(internal.workoutPlans.create, {
        userId,
        title,
        blocks,
        status: "failed",
        pushErrorReason: message,
        createdAt: Date.now(),
      });
      return { success: false, error: message, planId };
    }
  },
});

/** Delete a custom workout from Tonal and update Convex records. */
export const deleteWorkout = internalAction({
  args: {
    userId: v.id("users"),
    workoutId: v.string(),
  },
  handler: async (ctx, { userId, workoutId }): Promise<{ deleted: true }> =>
    withTokenRetry(ctx, userId, async (token) => {
      await tonalFetch(token, `/v6/user-workouts/${workoutId}`, {
        method: "DELETE",
      });

      await ctx.runMutation(internal.workoutPlans.markDeleted, {
        tonalWorkoutId: workoutId,
      });

      await ctx.runMutation(internal.tonal.cache.setCacheEntry, {
        userId,
        dataType: "customWorkouts",
        data: null,
        fetchedAt: 0,
        expiresAt: 0,
      });

      return { deleted: true };
    }),
});

/** Estimate workout duration from exercise blocks. */
export const estimateWorkout = internalAction({
  args: {
    userId: v.id("users"),
    blocks: blockInputValidator,
  },
  handler: async (ctx, { userId, blocks }): Promise<WorkoutEstimate> => {
    const sets = expandBlocksToSets(blocks as BlockInput[]);
    return withTokenRetry(ctx, userId, async (token) =>
      tonalFetch<WorkoutEstimate>(token, "/v6/user-workouts/estimate", {
        method: "POST",
        body: { sets },
      }),
    );
  },
});
