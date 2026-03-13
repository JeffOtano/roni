/** Muscle groups aligned with Tonal muscle readiness. */
export const MUSCLE_GROUPS = [
  "Chest",
  "Shoulders",
  "Back",
  "Triceps",
  "Biceps",
  "Abs",
  "Obliques",
  "Quads",
  "Glutes",
  "Hamstrings",
  "Calves",
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];
export type MuscleReadinessMap = Readonly<Partial<Record<MuscleGroup, number>>>;
export type SessionDurationMinutes = 30 | 45 | 60;

export interface PerExerciseHistoryEntry {
  movementId: string;
  muscleGroups: readonly MuscleGroup[];
  lastVolume: number;
  lastWeightAvg: number;
  lastSets: number;
  lastRepsPerSet: number;
  lastSessionDate: string;
}

export type StrengthLevel = "beginner" | "intermediate" | "advanced";
export type OverloadSuggestionKind = "add_1_set" | "add_weight" | "add_rep";

export interface OverloadSuggestion {
  movementId: string;
  kind: OverloadSuggestionKind;
  weightDeltaLbs?: number;
  repDelta?: number;
  label: string;
}

export interface MovementSessionSnapshot {
  sessionDate: string;
  sets: number;
  totalReps: number;
  repsPerSet: number;
  avgWeightLbs?: number;
}

export interface LastTimeAndSuggested {
  movementId: string;
  lastTimeText: string;
  suggestedText: string;
  plateauOptions?: string;
}

export interface WeeklyVolumeTarget {
  muscleGroup: MuscleGroup;
  targetSetsPerWeek: number;
  targetVolume?: number;
}

export type DayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type TrainingScheduleByDay = Readonly<Partial<Record<DayIndex, readonly MuscleGroup[]>>>;
export type ProjectedReadiness = Readonly<Partial<Record<MuscleGroup, number>>>;
