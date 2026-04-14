/**
 * Pure helpers, constants, and types shared by week programming actions.
 * Extracted to keep weekProgramming.ts under the 300-line limit.
 */

import type { Id } from "../_generated/dataModel";

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

/** Warmup/cooldown exercise counts per duration tier. */
export const WARMUP_COOLDOWN_COUNTS: Record<number, { warmup: number; cooldown: number }> = {
  30: { warmup: 1, cooldown: 1 },
  45: { warmup: 2, cooldown: 1 },
  60: { warmup: 2, cooldown: 2 },
};

export const DEFAULT_WARMUP_COOLDOWN = { warmup: 2, cooldown: 1 };

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

export type SessionType =
  | "push"
  | "pull"
  | "legs"
  | "upper"
  | "lower"
  | "full_body"
  | "chest"
  | "back"
  | "shoulders"
  | "arms";

export interface ExerciseSummary {
  movementId: string;
  name: string;
  muscleGroups: string[];
  sets: number;
  reps?: number;
  durationSeconds?: number;
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
  split: "ppl" | "upper_lower" | "full_body" | "bro_split",
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
  if (split === "bro_split") {
    // Classic bodybuilding body-part split: chest → back → shoulders → arms → legs.
    // Capped at 5 days — there are only 5 distinct body parts, so days beyond that
    // become rest days rather than cycling back to chest.
    const types: SessionType[] = ["chest", "back", "shoulders", "arms", "legs"];
    return trainingDayIndices.slice(0, types.length).map((dayIndex, i) => ({
      dayIndex,
      sessionType: types[i],
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

export function formatSessionTitle(
  sessionType: SessionType,
  _weekStartDate: string,
  dayIndex: number,
): string {
  const label = sessionType.replaceAll("_", " ");
  return `${label.charAt(0).toUpperCase() + label.slice(1)} – ${DAY_NAMES[dayIndex]}`;
}

// ---------------------------------------------------------------------------
// Arm position optimization — minimize arm adjustments within a workout
// ---------------------------------------------------------------------------

type ArmPosition = "low" | "mid" | "high";

/** Position sort order: low → mid → high for a smooth flow down→up. */
const ARM_POSITION_ORDER: Record<ArmPosition, number> = { low: 0, mid: 1, high: 2 };

const HIGH_PATTERNS = /pulldown|face pull|overhead|skull.?crush|high.?pull|lat.?raise/i;
const LOW_PATTERNS = /deadlift|rdl|squat|lunge|calf|leg press|hip|step.?up|goblet/i;

/** Sentinel for exercises without onMachineInfo (bodyweight/off-machine). */
const BODYWEIGHT_ACCESSORY = "__bodyweight__";

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
