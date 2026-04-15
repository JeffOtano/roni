/**
 * Workout block construction helpers.
 * Builds Tonal BlockInput arrays from movement IDs with progressive overload,
 * goal-based sets/reps, warmup, and cooldown support.
 */

import type { BlockInput, ExerciseInput, MovementCatalogEntry } from "../tonal/transforms";
import { TONAL_REST_MOVEMENT_ID } from "../tonal/transforms";
import { DELOAD_REPS, DELOAD_SET_MULTIPLIER } from "./periodization";
import type { RepSetScheme } from "./goalConfig";

const DEFAULT_REPS = 10;

/** Default duration (seconds) for timed/isometric exercises. */
const DEFAULT_DURATION_SECONDS = 30;

/** Sentinel for exercises without onMachineInfo (bodyweight/off-machine). */
const BODYWEIGHT_ACCESSORY = "__bodyweight__";

/** Fallback rest durations (seconds) when no goalScheme is provided. */
const DEFAULT_REST_COMPOUND = 90;
const DEFAULT_REST_ISOLATION = 60;
const REST_DURATION_WARMUP = 30;

const WARMUP_REPS = 15;
const WARMUP_SETS = 2;
const COOLDOWN_REPS = 12;
const COOLDOWN_SETS = 2;

/**
 * Build blocks for Tonal, grouped by accessory type with 2-exercise superset blocks.
 *
 * Exercises are grouped by their onMachineInfo.accessory value so the user minimizes
 * equipment switching. Within each accessory group, exercises are paired into 2-exercise
 * superset blocks. An odd exercise in a group gets its own straight-set block.
 * Accessory groups are ordered to match the input exercise order (which is already sorted
 * by accessory via sortForMinimalEquipmentSwitches).
 */
export function blocksFromMovementIds(
  movementIds: string[],
  suggestions?: { movementId: string; suggestedReps?: number }[],
  options?: {
    isDeload?: boolean;
    /** Catalog lookup — countReps for duration detection, onMachineInfo for accessory grouping. */
    catalog?: (MovementCatalogEntry & { onMachineInfo?: { accessory: string } })[];
    /** Goal-based sets/reps scheme. Used as fallback when no progressive overload suggestion exists. */
    goalScheme?: RepSetScheme;
  },
): BlockInput[] {
  if (movementIds.length === 0) return [];

  const repsByMovement = new Map<string, number>();
  for (const s of suggestions ?? []) {
    if (s.suggestedReps != null) {
      repsByMovement.set(s.movementId, s.suggestedReps);
    }
  }
  const catalogMap = new Map((options?.catalog ?? []).map((m) => [m.id, m]));
  const normalSets = options?.goalScheme?.sets ?? 3;
  const baseSets = options?.isDeload ? Math.round(normalSets * DELOAD_SET_MULTIPLIER) : normalSets;

  // Group movement IDs by accessory, preserving input order for group ordering.
  const groupOrder: string[] = [];
  const groupedByAccessory = new Map<string, string[]>();
  for (const movementId of movementIds) {
    const movement = catalogMap.get(movementId);
    const accessory = movement?.onMachineInfo?.accessory ?? BODYWEIGHT_ACCESSORY;
    if (!groupedByAccessory.has(accessory)) {
      groupOrder.push(accessory);
      groupedByAccessory.set(accessory, []);
    }
    groupedByAccessory.get(accessory)!.push(movementId);
  }

  const buildExercise = (movementId: string) => {
    const movement = catalogMap.get(movementId);
    const isDurationBased = movement ? !movement.countReps : false;
    if (isDurationBased) {
      return {
        movementId,
        sets: baseSets,
        duration: options?.goalScheme?.duration ?? DEFAULT_DURATION_SECONDS,
      };
    }
    return {
      movementId,
      sets: baseSets,
      reps: options?.isDeload
        ? DELOAD_REPS
        : (repsByMovement.get(movementId) ?? options?.goalScheme?.reps ?? DEFAULT_REPS),
    };
  };

  // Build 2-exercise superset blocks within each accessory group.
  const blocks: BlockInput[] = [];
  for (const accessory of groupOrder) {
    const ids = groupedByAccessory.get(accessory)!;
    for (let i = 0; i < ids.length; i += 2) {
      const pair = ids.slice(i, i + 2);
      const exercises = pair.map(buildExercise);

      // Inject rest into straight-set blocks (single exercise).
      // Supersets provide natural recovery via exercise alternation.
      if (exercises.length === 1) {
        const movement = catalogMap.get(pair[0]);
        const isCompound = (movement?.muscleGroups?.length ?? 0) >= 2;
        // Goal-aware rest: compound gets full goal rest, isolation gets 30s less (min 30s).
        const goalRest = options?.goalScheme?.restSeconds;
        const compoundRest = goalRest ?? DEFAULT_REST_COMPOUND;
        const isolationRest =
          goalRest != null ? Math.max(30, goalRest - 30) : DEFAULT_REST_ISOLATION;
        exercises.push({
          movementId: TONAL_REST_MOVEMENT_ID,
          sets: exercises[0].sets,
          duration: isCompound ? compoundRest : isolationRest,
        });
      }

      blocks.push({ exercises });
    }
  }

  return blocks;
}

/**
 * Build a warmup block. Each exercise gets warmUp: true flag (Tonal renders at 50% weight).
 */
export function warmupBlockFromMovementIds(
  movementIds: string[],
  options?: { catalog?: { id: string; countReps: boolean }[] },
): BlockInput[] {
  if (movementIds.length === 0) return [];
  const catalogMap = new Map((options?.catalog ?? []).map((m) => [m.id, m]));
  const exercises: ExerciseInput[] = movementIds.map((movementId) => {
    const movement = catalogMap.get(movementId);
    const isDurationBased = movement ? !movement.countReps : false;
    if (isDurationBased) {
      return {
        movementId,
        sets: WARMUP_SETS,
        duration: DEFAULT_DURATION_SECONDS,
        warmUp: true,
      };
    }
    return { movementId, sets: WARMUP_SETS, reps: WARMUP_REPS, warmUp: true };
  });

  // Inject rest into single-exercise warmup blocks.
  // Multi-exercise blocks are supersets with natural recovery via alternation.
  if (exercises.length === 1) {
    exercises.push({
      movementId: TONAL_REST_MOVEMENT_ID,
      sets: WARMUP_SETS,
      duration: REST_DURATION_WARMUP,
    });
  }

  return [{ exercises }];
}

/**
 * Build a cooldown block. Lower sets, moderate reps, no warmUp flag.
 */
export function cooldownBlockFromMovementIds(
  movementIds: string[],
  options?: { catalog?: { id: string; countReps: boolean }[] },
): BlockInput[] {
  if (movementIds.length === 0) return [];
  const catalogMap = new Map((options?.catalog ?? []).map((m) => [m.id, m]));
  return [
    {
      exercises: movementIds.map((movementId) => {
        const movement = catalogMap.get(movementId);
        const isDurationBased = movement ? !movement.countReps : false;
        if (isDurationBased) {
          return { movementId, sets: COOLDOWN_SETS, duration: DEFAULT_DURATION_SECONDS };
        }
        return { movementId, sets: COOLDOWN_SETS, reps: COOLDOWN_REPS };
      }),
    },
  ];
}
