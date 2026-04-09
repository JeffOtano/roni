/**
 * Hardware abstraction layer for the coaching engine.
 *
 * The coaching engine uses these interfaces instead of calling Tonal (or other
 * hardware) directly. This allows swapping in manual logging or other hardware
 * without changing the engine.
 *
 * **Manual logging:** Implement ExerciseCatalog with a static or user-defined list
 * of exercises (filter by muscle/equipment in memory). Implement pushWorkout by
 * persisting the workout to your own store and returning a local externalId.
 * Implement getHistory by returning completed workouts from your store (e.g.
 * user-marked completions with minimal fields).
 *
 * **Other hardware:** Same interfaces: provide a catalog (from device or API),
 * push workouts to the device/API and return its ID, and return completion
 * history from the device/API in the minimal GetHistoryResult shape.
 */

import type { ActionCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import type { BlockInput } from "./transforms";
import type { Activity, Movement } from "./types";

// ---------------------------------------------------------------------------
// Catalog: exercises, filterable by muscle / equipment
// ---------------------------------------------------------------------------

/** Minimal exercise shape for the abstraction; Tonal maps Movement to this. */
export interface HardwareExercise {
  id: string;
  name: string;
  muscleGroups: string[];
  equipment?: string;
}

/** Filters for getExercises. All specified filters are applied (AND). */
export interface ExerciseCatalogFilters {
  muscleGroups?: string[];
  equipment?: string;
}

/**
 * Exercise catalog: get exercises, optionally filtered by muscle groups and/or
 * equipment. Used by the coaching engine for exercise selection.
 *
 * **Manual logging:** Return a static or user-defined list; filter in memory
 * by muscleGroups (e.g. include if any movement.muscleGroups intersects) and
 * equipment (e.g. "Barbell", "Dumbbell") if your schema has it.
 *
 * **Other hardware:** Fetch catalog from device/API and map to HardwareExercise;
 * apply filters server-side or in memory.
 */
export interface ExerciseCatalog {
  getExercises(filters?: ExerciseCatalogFilters): Promise<HardwareExercise[]>;
}

// ---------------------------------------------------------------------------
// Workout format: generic structure (blocks, exercises, sets/reps/weight)
// ---------------------------------------------------------------------------

/**
 * Generic workout structure accepted by pushWorkout. Blocks contain exercises
 * with sets, reps (or duration), and optional flags (warmUp, spotter, etc.).
 *
 * **Manual logging:** Persist title + blocks to your DB; use your own IDs.
 * **Other hardware:** Map to the device/API format (e.g. Tonal sets array).
 */
export interface WorkoutFormat {
  title: string;
  blocks: BlockInput[];
}

// ---------------------------------------------------------------------------
// Push result: success + externalId vs error
// ---------------------------------------------------------------------------

/** Success: hardware stored the workout and returned an external ID. */
export interface PushWorkoutSuccess {
  success: true;
  externalId: string;
}

/** Failure: push failed; caller can retry or show fallback. */
export interface PushWorkoutFailure {
  success: false;
  error: string;
}

/** Result of pushing a workout to hardware (Tonal, manual log, or other). */
export type PushWorkoutResult = PushWorkoutSuccess | PushWorkoutFailure;

// ---------------------------------------------------------------------------
// History: completed workouts with minimal fields
// ---------------------------------------------------------------------------

/** Single completed workout entry for history lists. */
export interface CompletedWorkoutEntry {
  id: string;
  title: string;
  completedAt: string;
}

/**
 * List of completed workouts with minimal fields. Used for "recent activity",
 * cold-start checks, and activation metrics.
 *
 * **Manual logging:** Return workouts the user marked complete from your store.
 * **Other hardware:** Map device/API activity list to CompletedWorkoutEntry.
 */
export interface GetHistoryResult {
  workouts: CompletedWorkoutEntry[];
}

// ---------------------------------------------------------------------------
// Hardware adapter: catalog + push + history
// ---------------------------------------------------------------------------

/**
 * Full hardware adapter: exercise catalog, push workout, and get history.
 * The coaching engine uses this instead of calling Tonal (or other) directly.
 */
export interface HardwareAdapter {
  /** Exercise catalog with optional filters. */
  getExercises(filters?: ExerciseCatalogFilters): Promise<HardwareExercise[]>;

  /** Push a workout to the hardware; returns externalId or error. */
  pushWorkout(workout: WorkoutFormat): Promise<PushWorkoutResult>;

  /** Get completed workouts with minimal fields. */
  getHistory(opts?: { limit?: number }): Promise<GetHistoryResult>;
}

// ---------------------------------------------------------------------------
// Tonal implementation (wraps existing proxy)
// ---------------------------------------------------------------------------

/** Map Tonal Movement to HardwareExercise; exported for testing. */
export function movementToHardwareExercise(m: Movement): HardwareExercise {
  return {
    id: m.id,
    name: m.name,
    muscleGroups: m.muscleGroups ?? [],
    equipment: m.onMachineInfo?.accessory,
  };
}

/** Apply catalog filters; exported for testing. */
export function filterExercises(
  exercises: HardwareExercise[],
  filters?: ExerciseCatalogFilters,
): HardwareExercise[] {
  if (!filters) return exercises;

  let result = exercises;

  if (filters.muscleGroups?.length) {
    const set = new Set(filters.muscleGroups);
    result = result.filter((e) => e.muscleGroups.some((g) => set.has(g)));
  }

  if (filters.equipment !== undefined && filters.equipment !== "") {
    result = result.filter((e) => e.equipment === filters.equipment);
  }

  return result;
}

/** Map Tonal Activity to CompletedWorkoutEntry; exported for testing. */
export function activityToCompletedEntry(a: Activity): CompletedWorkoutEntry {
  return {
    id: a.activityId,
    title: a.workoutPreview?.workoutTitle ?? "Workout",
    completedAt: a.activityTime,
  };
}

/**
 * Create the Tonal-backed hardware adapter. Uses the movements table and
 * proxy actions (createWorkout, fetchWorkoutHistory). Call from a Convex
 * action that has ActionCtx and the authenticated userId.
 *
 * **How createWorkout is invoked through the abstraction:** The coaching
 * engine calls `adapter.pushWorkout({ title, blocks })`. The Tonal
 * implementation calls `ctx.runAction(internal.tonal.mutations.createWorkout, {
 * userId, title, blocks })`, which validates movement IDs, expands blocks to
 * sets, POSTs to Tonal, and records the plan in workoutPlans. On success we
 * return `{ success: true, externalId: workout.id }`; on throw we return
 * `{ success: false, error: message }`.
 */
export function createTonalHardware(ctx: ActionCtx, userId: Id<"users">): HardwareAdapter {
  return {
    async getExercises(filters) {
      const movements = await ctx.runQuery(internal.tonal.movementSync.getAllMovements);
      const exercises = movements.map(movementToHardwareExercise);
      return filterExercises(exercises, filters);
    },

    async pushWorkout(workout) {
      try {
        const result = await ctx.runAction(internal.tonal.mutations.createWorkout, {
          userId,
          title: workout.title,
          blocks: workout.blocks,
        });
        if (result.success) {
          return { success: true, externalId: result.workoutId };
        }
        return { success: false, error: result.error };
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to push workout";
        return { success: false, error: message };
      }
    },

    async getHistory(opts) {
      const limit = opts?.limit ?? 20;
      const activities = await ctx.runAction(internal.tonal.proxy.fetchWorkoutHistory, {
        userId,
        limit,
      });
      return {
        workouts: activities.map(activityToCompletedEntry),
      };
    },
  };
}
