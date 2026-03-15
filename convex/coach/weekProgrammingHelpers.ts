/**
 * Pure helpers, constants, and types shared by week programming actions.
 * Extracted to keep weekProgramming.ts under the 300-line limit.
 */

import type { BlockInput } from "../tonal/transforms";
import type { Id } from "../_generated/dataModel";
import { DELOAD_REPS, DELOAD_SET_MULTIPLIER } from "../coach/periodization";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const SESSION_DURATION_TO_MAX_EXERCISES: Record<number, number> = {
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
};

export const DEFAULT_REPS = 10;

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
 * Build blocks for Tonal. Optional suggestions from getLastTimeAndSuggested (progressive overload)
 * set reps per movement (e.g. 8 when adding weight, last+1 when adding rep).
 * Tonal blocks accept only movementId, sets, reps (and optional duration/spotter/etc.); suggested
 * weight range (e.g. "72-75 lbs") is not sent to Tonal and is for display only in the app.
 */
export function blocksFromMovementIds(
  movementIds: string[],
  suggestions?: { movementId: string; suggestedReps?: number }[],
  options?: { isDeload?: boolean },
): BlockInput[] {
  const repsByMovement = new Map<string, number>();
  for (const s of suggestions ?? []) {
    if (s.suggestedReps != null) {
      repsByMovement.set(s.movementId, s.suggestedReps);
    }
  }
  const normalSets = 3;
  const baseSets = options?.isDeload ? Math.round(normalSets * DELOAD_SET_MULTIPLIER) : normalSets;
  return [
    {
      exercises: movementIds.map((movementId) => ({
        movementId,
        sets: baseSets,
        reps: options?.isDeload ? DELOAD_REPS : (repsByMovement.get(movementId) ?? DEFAULT_REPS),
      })),
    },
  ];
}

export function formatSessionTitle(
  sessionType: SessionType,
  _weekStartDate: string,
  dayIndex: number,
): string {
  const label = sessionType.replaceAll("_", " ");
  return `${label.charAt(0).toUpperCase() + label.slice(1)} – ${DAY_NAMES[dayIndex]}`;
}
