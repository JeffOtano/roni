/** Volume, intensity, progressive overload (pure functions). */
export * from "./volumeIntensityTypes";
import {
  type DayIndex,
  MUSCLE_GROUPS,
  type MuscleGroup,
  type MuscleReadinessMap,
  type PerExerciseHistoryEntry,
  type ProjectedReadiness,
  type TrainingScheduleByDay,
} from "./volumeIntensityTypes";
import type {
  LastTimeAndSuggested,
  MovementSessionSnapshot,
  OverloadSuggestion,
  SessionDurationMinutes,
  StrengthLevel,
  WeeklyVolumeTarget,
} from "./volumeIntensityTypes";

const WEIGHT_STEP_LBS = 2.5;
const REP_STEP = 1;
const READINESS_FLOOR_AFTER_TRAINING = 30;
const RECOVERY_DAYS = 3;

export function defaultReadiness(): Record<MuscleGroup, number> {
  const out = {} as Record<MuscleGroup, number>;
  for (const g of MUSCLE_GROUPS) {
    out[g] = 100;
  }
  return out;
}

export function getProgressiveOverloadSuggestions(
  history: readonly PerExerciseHistoryEntry[],
  options: { preferWeightOverRep?: boolean; maxWeightDeltaLbs?: number } = {},
): OverloadSuggestion[] {
  const preferWeight = options.preferWeightOverRep ?? true;
  const maxDelta = options.maxWeightDeltaLbs ?? 5;
  const out: OverloadSuggestion[] = [];

  for (const entry of history) {
    const weightStep = Math.min(WEIGHT_STEP_LBS, maxDelta);
    if (preferWeight && entry.lastWeightAvg > 0) {
      out.push({
        movementId: entry.movementId,
        kind: "add_weight",
        weightDeltaLbs: weightStep,
        label: `+${weightStep} lbs`,
      });
      continue;
    }
    if (entry.lastRepsPerSet > 0) {
      out.push({
        movementId: entry.movementId,
        kind: "add_rep",
        repDelta: REP_STEP,
        label: `same weight, +${REP_STEP} rep`,
      });
      continue;
    }
    out.push({
      movementId: entry.movementId,
      kind: "add_1_set",
      label: "add 1 set",
    });
  }
  return out;
}

export function getWeeklyVolumeTargets(
  strengthLevel: StrengthLevel,
  sessionDurationMinutes: SessionDurationMinutes,
  options: { preferredSplit?: "ppl" | "upper_lower" | "full_body" } = {},
): WeeklyVolumeTarget[] {
  const split = options.preferredSplit ?? "ppl";
  const setsPerSession = sessionDurationMinutes >= 45 ? 12 : sessionDurationMinutes >= 30 ? 8 : 6;
  const sessionsPerWeek = split === "full_body" ? 3 : 4;
  const totalSetsPerWeek = setsPerSession * sessionsPerWeek;

  const byLevel: Record<StrengthLevel, number> = {
    beginner: 8,
    intermediate: 12,
    advanced: 16,
  };
  const setsPerMuscleGroup = Math.min(byLevel[strengthLevel], Math.ceil(totalSetsPerWeek / 6));

  return MUSCLE_GROUPS.map((muscleGroup) => ({
    muscleGroup,
    targetSetsPerWeek: setsPerMuscleGroup,
  }));
}

export function projectReadinessByDay(
  currentReadiness: MuscleReadinessMap,
  schedule: TrainingScheduleByDay,
): Record<DayIndex, ProjectedReadiness> {
  const result: Record<DayIndex, ProjectedReadiness> = {
    0: {},
    1: {},
    2: {},
    3: {},
    4: {},
    5: {},
    6: {},
  };

  for (const muscle of MUSCLE_GROUPS) {
    const base = currentReadiness[muscle] ?? 100;
    for (let d = 0; d <= 6; d++) {
      const day = d as DayIndex;
      const readiness = computeReadinessForDay(schedule, muscle, d, base);
      (result[day] as Record<MuscleGroup, number>)[muscle] = Math.round(
        Math.min(100, Math.max(0, readiness)),
      );
    }
  }

  return result;
}

function computeReadinessForDay(
  schedule: TrainingScheduleByDay,
  muscle: MuscleGroup,
  dayIndex: number,
  base: number,
): number {
  const trainedToday = schedule[dayIndex as DayIndex]?.includes(muscle) ?? false;
  if (trainedToday) return READINESS_FLOOR_AFTER_TRAINING;
  const lastTrainedDay = lastTrainingDayBefore(schedule, muscle, dayIndex);
  if (lastTrainedDay === null) return base;
  const daysSince = dayIndex - lastTrainedDay;
  if (daysSince >= RECOVERY_DAYS) return 100;
  const recovery = (daysSince / RECOVERY_DAYS) * (100 - READINESS_FLOOR_AFTER_TRAINING);
  return READINESS_FLOOR_AFTER_TRAINING + recovery;
}

function lastTrainingDayBefore(
  schedule: TrainingScheduleByDay,
  muscle: MuscleGroup,
  beforeDay: number,
): number | null {
  for (let d = beforeDay - 1; d >= 0; d--) {
    if (schedule[d as DayIndex]?.includes(muscle)) return d;
  }
  return null;
}

export function getReadinessOnDay(
  currentReadiness: MuscleReadinessMap,
  schedule: TrainingScheduleByDay,
  dayIndex: DayIndex,
): ProjectedReadiness {
  const byDay = projectReadinessByDay(currentReadiness, schedule);
  return byDay[dayIndex];
}

export function formatLastTimeDisplay(entry: PerExerciseHistoryEntry): string {
  const setsReps = `${entry.lastSets}×${entry.lastRepsPerSet}`;
  if (entry.lastWeightAvg > 0) {
    return `${setsReps} @ ${Math.round(entry.lastWeightAvg)} avg`;
  }
  return setsReps;
}

export function getSuggestedWeightRange(
  suggestion: OverloadSuggestion,
  lastWeightLbs: number,
): { low: number; high: number } | null {
  if (suggestion.kind !== "add_weight" || suggestion.weightDeltaLbs == null || lastWeightLbs <= 0) {
    return null;
  }
  const target = lastWeightLbs + suggestion.weightDeltaLbs;
  return { low: Math.round(target - 1), high: Math.round(target + 2) };
}

export function detectPlateau(
  sessions: readonly { avgWeightLbs?: number }[],
  thresholdLbs: number = 2,
): boolean {
  const withWeight = sessions.filter((s) => s.avgWeightLbs != null && s.avgWeightLbs > 0);
  if (withWeight.length < 3) return false;
  const recent = withWeight.slice(0, 3);
  const avg = recent.reduce((s, x) => s + (x.avgWeightLbs ?? 0), 0) / recent.length;
  return recent.every((s) => Math.abs((s.avgWeightLbs ?? 0) - avg) <= thresholdLbs);
}

const PLATEAU_OPTIONS = "Options: add a set, increase weight, or switch exercise.";

function historyEntriesFromSessions(
  perMovementSessions: ReadonlyMap<string, readonly MovementSessionSnapshot[]>,
  movementIds: string[],
): PerExerciseHistoryEntry[] {
  const out: PerExerciseHistoryEntry[] = [];
  for (const movementId of movementIds) {
    const sessions = perMovementSessions.get(movementId);
    if (!sessions?.length) continue;
    const last = sessions[0];
    out.push({
      movementId,
      muscleGroups: ["Chest" as MuscleGroup],
      lastVolume: (last.avgWeightLbs ?? 0) * last.totalReps,
      lastWeightAvg: last.avgWeightLbs ?? 0,
      lastSets: last.sets,
      lastRepsPerSet: last.repsPerSet,
      lastSessionDate: last.sessionDate,
    });
  }
  return out;
}

function suggestedTextFor(
  entry: PerExerciseHistoryEntry,
  suggestion: OverloadSuggestion | undefined,
): string {
  if (suggestion?.kind === "add_weight" && entry.lastWeightAvg > 0) {
    const range = getSuggestedWeightRange(suggestion, entry.lastWeightAvg);
    return range ? `${range.low}–${range.high} lbs` : suggestion.label;
  }
  return suggestion?.label ?? "—";
}

export function computeLastTimeAndSuggested(
  perMovementSessions: ReadonlyMap<string, readonly MovementSessionSnapshot[]>,
  movementIdsFilter?: readonly string[],
  options: { preferWeightOverRep?: boolean; maxWeightDeltaLbs?: number } = {},
): LastTimeAndSuggested[] {
  const movementIds = movementIdsFilter?.length
    ? [...perMovementSessions.keys()].filter((id) => movementIdsFilter.includes(id))
    : [...perMovementSessions.keys()];
  const historyEntries = historyEntriesFromSessions(perMovementSessions, movementIds);
  const suggestions = getProgressiveOverloadSuggestions(historyEntries, options);
  const suggestionByMovement = new Map(suggestions.map((s) => [s.movementId, s]));

  return historyEntries.map((entry) => {
    const suggestion = suggestionByMovement.get(entry.movementId);
    const sessions = perMovementSessions.get(entry.movementId) ?? [];
    return {
      movementId: entry.movementId,
      lastTimeText: formatLastTimeDisplay(entry),
      suggestedText: suggestedTextFor(entry, suggestion),
      plateauOptions: detectPlateau(sessions) ? PLATEAU_OPTIONS : undefined,
    };
  });
}
