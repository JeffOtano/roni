/**
 * Schedule page data: enriched week plan + workout titles + exercise names.
 * Combines the enriched week plan with workout plan details and movement
 * catalog lookups so the frontend receives everything in one action call.
 */

import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import type { EnrichedWeekPlan } from "./weekPlanEnriched";
import type { Movement } from "./tonal/types";
import { DAY_NAMES } from "./coach/weekProgrammingHelpers";
import { TONAL_REST_MOVEMENT_ID } from "./tonal/transforms";

// ---------------------------------------------------------------------------
// Return types
// ---------------------------------------------------------------------------

export interface ScheduleExercise {
  name: string;
  sets: number;
  reps?: number;
  durationSeconds?: number;
  eccentric?: boolean;
  chains?: boolean;
  burnout?: boolean;
  dropSet?: boolean;
  spotter?: boolean;
  /** Index (1-based) identifying the superset group this exercise belongs to. Undefined for straight sets. */
  supersetGroup?: number;
}

export interface ScheduleDay {
  dayIndex: number;
  dayName: string;
  date: string;
  sessionType: string;
  derivedStatus: "rest" | "programmed" | "completed" | "failed";
  workoutTitle?: string;
  exercises: ScheduleExercise[];
  estimatedDuration?: number;
  tonalWorkoutId?: string;
}

export interface ScheduleData {
  weekStartDate: string;
  days: ScheduleDay[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build ISO date string for a day offset from the week start (Monday). */
function dayDate(weekStartDate: string, dayIndex: number): string {
  const d = new Date(weekStartDate + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + dayIndex);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Public action
// ---------------------------------------------------------------------------

export const getScheduleData = action({
  args: {},
  handler: async (ctx): Promise<ScheduleData | null> => {
    const userId = await ctx.runQuery(internal.lib.auth.resolveEffectiveUserId, {});
    if (!userId) throw new Error("Not authenticated");

    // 1. Fetch enriched week plan (handles Tonal activity sync)
    const enriched = (await ctx.runAction(
      api.weekPlanEnriched.getWeekPlanEnriched,
      {},
    )) as EnrichedWeekPlan | null;

    if (!enriched) return null;

    // 2. Collect workout plan IDs and fetch details
    const wpIds = enriched.days
      .map((d) => d.workoutPlanId)
      .filter((id): id is string => id !== undefined);
    const uniqueWpIds = [...new Set(wpIds)];

    const workoutPlans = new Map<string, Doc<"workoutPlans">>();
    const planResults = await Promise.all(
      uniqueWpIds.map((planId) =>
        ctx.runQuery(internal.workoutPlans.getById, {
          planId: planId as Doc<"workoutPlans">["_id"],
          userId,
        }),
      ),
    );
    for (let i = 0; i < uniqueWpIds.length; i++) {
      const wp = planResults[i] as Doc<"workoutPlans"> | null;
      if (wp) workoutPlans.set(uniqueWpIds[i], wp);
    }

    // 3. Collect all movement IDs across all workout plans for name lookup
    const allMovementIds = new Set<string>();
    for (const wp of workoutPlans.values()) {
      for (const block of wp.blocks) {
        for (const ex of block.exercises) {
          allMovementIds.add(ex.movementId);
        }
      }
    }

    // 4. Fetch movement catalog for name + duration/rep resolution
    let movementMap = new Map<string, { name: string; countReps: boolean }>();
    if (allMovementIds.size > 0) {
      const movements: Movement[] = await ctx.runQuery(internal.tonal.movementSync.getAllMovements);
      movementMap = new Map(movements.map((m) => [m.id, { name: m.name, countReps: m.countReps }]));
    }

    // 5. Resolve display shape for an exercise (reps vs duration).
    //    Catalog countReps is authoritative (matches push path in transforms.ts).
    function resolveShape(
      ex: { reps?: number; duration?: number },
      movement?: { countReps: boolean },
    ): { reps?: number; durationSeconds?: number } {
      if (movement) {
        if (!movement.countReps) return { durationSeconds: ex.duration ?? 30 };
        return { reps: ex.reps ?? 10 };
      }
      if (ex.duration != null) return { durationSeconds: ex.duration };
      if (ex.reps != null) return { reps: ex.reps };
      return {};
    }

    // 6. Build schedule days
    const days: ScheduleDay[] = enriched.days.map((day, i) => {
      const wp = day.workoutPlanId ? workoutPlans.get(day.workoutPlanId) : undefined;
      const exercises: ScheduleExercise[] = [];

      let supersetCounter = 0;
      if (wp) {
        for (const block of wp.blocks) {
          const nonRestExercises = block.exercises.filter(
            (e) => e.movementId !== TONAL_REST_MOVEMENT_ID,
          );
          const supersetGroup = nonRestExercises.length >= 2 ? ++supersetCounter : undefined;
          for (const ex of nonRestExercises) {
            const movement = movementMap.get(ex.movementId);
            exercises.push({
              name: movement?.name ?? ex.movementId,
              sets: ex.sets,
              ...resolveShape(ex, movement),
              ...(ex.eccentric && { eccentric: true }),
              ...(ex.chains && { chains: true }),
              ...(ex.burnout && { burnout: true }),
              ...(ex.dropSet && { dropSet: true }),
              ...(ex.spotter && { spotter: true }),
              ...(supersetGroup != null && { supersetGroup }),
            });
          }
        }
      }

      return {
        dayIndex: i,
        dayName: DAY_NAMES[i],
        date: dayDate(enriched.weekStartDate, i),
        sessionType: day.sessionType,
        derivedStatus: day.derivedStatus,
        workoutTitle: wp?.title,
        exercises,
        estimatedDuration: day.estimatedDuration,
        tonalWorkoutId: day.tonalWorkoutId,
      };
    });

    return {
      weekStartDate: enriched.weekStartDate,
      days,
    };
  },
});
