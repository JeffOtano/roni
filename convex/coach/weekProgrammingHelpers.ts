/**
 * Pure helpers, constants, and types shared by week programming actions.
 * Extracted to keep weekProgramming.ts under the 300-line limit.
 */

import type { Id } from "../_generated/dataModel";
import type { BlockInput, ExerciseInput, MovementCatalogEntry } from "../tonal/transforms";
import { TONAL_REST_MOVEMENT_ID } from "../tonal/transforms";
import { DELOAD_REPS, DELOAD_SET_MULTIPLIER } from "../coach/periodization";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const SESSION_DURATION_TO_MAX_EXERCISES: Record<number, number> = {
  20: 4,
  30: 6,
  45: 8,
  60: 10,
};

export const DEFAULT_MAX_EXERCISES = 8;

/** Session type to target muscle groups (Tonal names). */
export const SESSION_TYPE_MUSCLES: Record<string, string[]> = {
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
  chest: ["Chest", "Triceps"],
  back: ["Back", "Biceps"],
  shoulders: ["Shoulders", "Triceps"],
  arms: ["Biceps", "Triceps"],
  core: ["Core", "Obliques"],
  glutes_hamstrings: ["Glutes", "Hamstrings"],
  chest_back: ["Chest", "Back"],
  mobility: [],
  recovery: [],
};

export const DEFAULT_REPS = 10;

/** Rest durations in seconds by exercise type. */
const REST_DURATION_COMPOUND = 90;
const REST_DURATION_ISOLATION = 60;
const REST_DURATION_WARMUP = 30;

/** Warmup/cooldown exercise counts per duration tier. */
export const WARMUP_COOLDOWN_COUNTS: Record<number, { warmup: number; cooldown: number }> = {
  30: { warmup: 1, cooldown: 1 },
  45: { warmup: 2, cooldown: 1 },
  60: { warmup: 2, cooldown: 2 },
};

export const DEFAULT_WARMUP_COOLDOWN = { warmup: 2, cooldown: 1 };

const WARMUP_REPS = 15;
const WARMUP_SETS = 2;
const COOLDOWN_REPS = 12;
const COOLDOWN_SETS = 2;

export const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SessionType = "push" | "pull" | "legs" | "upper" | "lower" | "full_body";

export interface ExerciseSummary {
  movementId: string;
  name: string;
  muscleGroups: string[];
  sets: number;
  reps: number;
  lastTime?: string;
  suggestedTarget?: string;
  lastWeight?: number;
  targetWeight?: number;
}

export interface DraftDaySummary {
  dayIndex: number;
  dayName: string;
  sessionType: string;
  workoutPlanId: Id<"workoutPlans">;
  estimatedDuration: number;
  exercises: ExerciseSummary[];
}

export interface DraftWeekSummary {
  weekStartDate: string;
  preferredSplit: string;
  targetDays: number;
  sessionDurationMinutes: number;
  days: DraftDaySummary[];
}

// ---------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------

/** Training day indices for targetDays (e.g. 3 -> Mon/Wed/Fri = 0, 2, 4). */
export function getTrainingDayIndices(targetDays: number): number[] {
  if (targetDays <= 0 || targetDays > 7) return [];
  const step = targetDays === 7 ? 1 : Math.floor(7 / targetDays);
  const indices: number[] = [];
  for (let i = 0; i < targetDays && indices.length < targetDays; i++) {
    indices.push(Math.min(i * step, 6));
  }
  return [...new Set(indices)].sort((a, b) => a - b);
}

/** Session types for the week for a given split (one per training day in order). */
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

export function parseUserLevel(level: string | undefined): number {
  if (!level) return 1;
  const l = level.toLowerCase();
  if (l.includes("beginner") || l === "1") return 1;
  if (l.includes("intermediate") || l === "2") return 2;
  if (l.includes("advanced") || l === "3") return 3;
  return 1;
}

/**
 * Build blocks for Tonal, grouped by accessory type with 2-exercise superset blocks.
 *
 * Exercises are grouped by their onMachineInfo.accessory value so the user minimizes
 * equipment switching. Within each accessory group, exercises are paired into 2-exercise
 * superset blocks. An odd exercise in a group gets its own straight-set block.
 * Accessory groups are ordered to match the input exercise order (which is already sorted
 * by accessory via sortForMinimalEquipmentSwitches).
 */
/** Default duration (seconds) for timed/isometric exercises. */
const DEFAULT_DURATION_SECONDS = 30;

/** Sentinel for exercises without onMachineInfo (bodyweight/off-machine). */
const BODYWEIGHT_ACCESSORY = "__bodyweight__";

export function blocksFromMovementIds(
  movementIds: string[],
  suggestions?: { movementId: string; suggestedReps?: number }[],
  options?: {
    isDeload?: boolean;
    /** Catalog lookup — countReps for duration detection, onMachineInfo for accessory grouping. */
    catalog?: (MovementCatalogEntry & { onMachineInfo?: { accessory: string } })[];
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
  const normalSets = 3;
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
      return { movementId, sets: baseSets, duration: DEFAULT_DURATION_SECONDS };
    }
    return {
      movementId,
      sets: baseSets,
      reps: options?.isDeload ? DELOAD_REPS : (repsByMovement.get(movementId) ?? DEFAULT_REPS),
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
        exercises.push({
          movementId: TONAL_REST_MOVEMENT_ID,
          sets: exercises[0].sets,
          duration: isCompound ? REST_DURATION_COMPOUND : REST_DURATION_ISOLATION,
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

// ---------------------------------------------------------------------------
// Arm position optimization — minimize arm adjustments within a workout
// ---------------------------------------------------------------------------

type ArmPosition = "low" | "mid" | "high";

/** Position sort order: low → mid → high for a smooth flow down→up. */
const ARM_POSITION_ORDER: Record<ArmPosition, number> = { low: 0, mid: 1, high: 2 };

const HIGH_PATTERNS = /pulldown|face pull|overhead|skull.?crush|high.?pull|lat.?raise/i;
const LOW_PATTERNS = /deadlift|rdl|squat|lunge|calf|leg press|hip|step.?up|goblet/i;

/**
 * Infer arm position from exercise name and muscle groups.
 * Heuristic: name patterns first (most reliable), then muscle-group fallback.
 */
export function inferArmPosition(movement: { name: string; muscleGroups: string[] }): ArmPosition {
  const name = movement.name;
  if (HIGH_PATTERNS.test(name)) return "high";
  if (LOW_PATTERNS.test(name)) return "low";
  // Leg exercises default to low
  const lowerMuscles = ["quads", "glutes", "hamstrings", "calves"];
  if (movement.muscleGroups.some((g) => lowerMuscles.includes(g.toLowerCase()))) return "low";
  return "mid";
}

/**
 * Sort movement IDs to minimize Tonal equipment switching.
 *
 * Primary sort: accessory type — groups all exercises by onMachineInfo.accessory
 * so the user changes equipment as few times as possible.
 * Secondary sort: arm position (low → mid → high) within each accessory group
 * to minimize arm height adjustments.
 *
 * Exercises without onMachineInfo (bodyweight) are grouped together at the end.
 */
export function sortForMinimalEquipmentSwitches(
  movementIds: string[],
  catalog: {
    id: string;
    name: string;
    muscleGroups: string[];
    onMachineInfo?: { accessory: string };
  }[],
): string[] {
  const catalogMap = new Map(catalog.map((m) => [m.id, m]));

  // Assign stable numeric indices to accessory types in first-seen order.
  // This keeps the most common accessory (usually handles) first.
  const accessoryOrder = new Map<string, number>();
  for (const movementId of movementIds) {
    const m = catalogMap.get(movementId);
    const accessory = m?.onMachineInfo?.accessory ?? BODYWEIGHT_ACCESSORY;
    if (!accessoryOrder.has(accessory)) {
      accessoryOrder.set(accessory, accessoryOrder.size);
    }
  }

  return [...movementIds].sort((a, b) => {
    const ma = catalogMap.get(a);
    const mb = catalogMap.get(b);

    // Primary: accessory type
    const accA = accessoryOrder.get(ma?.onMachineInfo?.accessory ?? BODYWEIGHT_ACCESSORY) ?? 999;
    const accB = accessoryOrder.get(mb?.onMachineInfo?.accessory ?? BODYWEIGHT_ACCESSORY) ?? 999;
    if (accA !== accB) return accA - accB;

    // Secondary: arm position within same accessory
    const posA = ma ? ARM_POSITION_ORDER[inferArmPosition(ma)] : 1;
    const posB = mb ? ARM_POSITION_ORDER[inferArmPosition(mb)] : 1;
    return posA - posB;
  });
}

export function formatSessionTitle(
  sessionType: SessionType,
  _weekStartDate: string,
  dayIndex: number,
): string {
  const label = sessionType.replaceAll("_", " ");
  return `${label.charAt(0).toUpperCase() + label.slice(1)} – ${DAY_NAMES[dayIndex]}`;
}
