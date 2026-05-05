import type { BlockInput, ExerciseInput } from "../tonal/transforms";
import { TONAL_REST_MOVEMENT_ID } from "../tonal/transforms";
import type { Movement } from "../tonal/types";

const GARMIN_WORKOUT_PROVIDER = "Roni";
const MAX_WORKOUT_NAME_LENGTH = 80;
const MAX_DESCRIPTION_LENGTH = 512;
const MAX_STEP_DESCRIPTION_LENGTH = 80;
const DEFAULT_REPS = 10;
const DEFAULT_DURATION_SECONDS = 30;
const DEFAULT_REST_SECONDS = 60;

interface MovementLookup {
  name: string;
  countReps: boolean;
  isAlternating: boolean;
}

type GarminIntensity = "REST" | "WARMUP" | "INTERVAL";
type GarminDurationType = "TIME" | "REPS";

export interface GarminWorkoutStep {
  type: "WorkoutStep";
  stepOrder: number;
  intensity: GarminIntensity;
  description: string | null;
  durationType: GarminDurationType;
  durationValue: number;
  durationValueType: null;
  targetType: "OPEN";
  targetValue: null;
  targetValueLow: null;
  targetValueHigh: null;
  targetValueType: null;
  strokeType: null;
  equipmentType: null;
  exerciseCategory: string | null;
  exerciseName: string | null;
  weightValue: null;
  weightDisplayUnit: null;
}

export interface GarminWorkoutPayload {
  workoutName: string;
  description: string;
  sport: "STRENGTH_TRAINING";
  workoutProvider: string;
  workoutSourceId: string;
  steps: GarminWorkoutStep[];
}

function truncate(input: string, maxLength: number): string {
  return input.length <= maxLength ? input : input.slice(0, maxLength).trimEnd();
}

function normalizeName(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function inferGarminExerciseCategory(exerciseName: string): string {
  const normalized = normalizeName(exerciseName);
  const matchers: { category: string; patterns: readonly string[] }[] = [
    { category: "BENCH_PRESS", patterns: ["bench press", "chest press"] },
    { category: "CALF_RAISE", patterns: ["calf raise"] },
    { category: "CARRY", patterns: ["carry"] },
    { category: "CHOP", patterns: ["chop"] },
    { category: "CORE", patterns: ["core"] },
    { category: "CRUNCH", patterns: ["crunch"] },
    { category: "CURL", patterns: ["curl"] },
    { category: "DEADLIFT", patterns: ["deadlift"] },
    { category: "FLYE", patterns: ["fly", "flye"] },
    { category: "HIP_RAISE", patterns: ["hip raise", "glute bridge"] },
    { category: "HIP_STABILITY", patterns: ["hip stability"] },
    { category: "HYPEREXTENSION", patterns: ["hyperextension"] },
    { category: "LATERAL_RAISE", patterns: ["lateral raise"] },
    { category: "LEG_CURL", patterns: ["leg curl", "hamstring curl"] },
    { category: "LEG_RAISE", patterns: ["leg raise"] },
    { category: "LUNGE", patterns: ["lunge", "split squat"] },
    { category: "OLYMPIC_LIFT", patterns: ["clean", "snatch"] },
    { category: "PLANK", patterns: ["plank"] },
    { category: "PULL_UP", patterns: ["pull up", "chin up"] },
    { category: "PUSH_UP", patterns: ["push up"] },
    { category: "ROW", patterns: ["row"] },
    { category: "SHOULDER_PRESS", patterns: ["shoulder press", "overhead press"] },
    { category: "SHRUG", patterns: ["shrug"] },
    { category: "SIT_UP", patterns: ["sit up"] },
    { category: "SQUAT", patterns: ["squat"] },
    { category: "TRICEPS_EXTENSION", patterns: ["triceps", "tricep"] },
  ];

  for (const matcher of matchers) {
    if (matcher.patterns.some((pattern) => normalized.includes(pattern))) {
      return matcher.category;
    }
  }
  return "UNKNOWN";
}

function describeFlags(exercise: ExerciseInput): string | null {
  const flags = [
    exercise.warmUp ? "warm-up" : null,
    exercise.eccentric ? "eccentric" : null,
    exercise.chains ? "chains" : null,
    exercise.burnout ? "burnout" : null,
    exercise.dropSet ? "drop set" : null,
    exercise.spotter ? "spotter" : null,
  ].filter((flag): flag is string => flag !== null);
  return flags.length > 0 ? flags.join(", ") : null;
}

function resolveDuration(
  exercise: ExerciseInput,
  movement: MovementLookup | undefined,
): { durationType: GarminDurationType; durationValue: number } {
  if (exercise.duration != null || movement?.countReps === false) {
    return {
      durationType: "TIME",
      durationValue: Math.max(1, Math.round(exercise.duration ?? DEFAULT_DURATION_SECONDS)),
    };
  }

  const baseReps = Math.max(1, Math.round(exercise.reps ?? DEFAULT_REPS));
  return {
    durationType: "REPS",
    durationValue: movement?.isAlternating ? baseReps * 2 : baseReps,
  };
}

function buildRestStep(stepOrder: number, exercise: ExerciseInput): GarminWorkoutStep {
  return {
    type: "WorkoutStep",
    stepOrder,
    intensity: "REST",
    description: null,
    durationType: "TIME",
    durationValue: Math.max(1, Math.round(exercise.duration ?? DEFAULT_REST_SECONDS)),
    durationValueType: null,
    targetType: "OPEN",
    targetValue: null,
    targetValueLow: null,
    targetValueHigh: null,
    targetValueType: null,
    strokeType: null,
    equipmentType: null,
    exerciseCategory: null,
    exerciseName: "Rest",
    weightValue: null,
    weightDisplayUnit: null,
  };
}

function buildExerciseStep({
  stepOrder,
  exercise,
  movement,
  round,
}: {
  stepOrder: number;
  exercise: ExerciseInput;
  movement: MovementLookup | undefined;
  round: number;
}): GarminWorkoutStep {
  const exerciseName = movement?.name ?? exercise.movementId;
  const duration = resolveDuration(exercise, movement);
  const flags = describeFlags(exercise);
  const description = flags
    ? truncate(`Set ${round} of ${exercise.sets}: ${flags}`, MAX_STEP_DESCRIPTION_LENGTH)
    : null;

  return {
    type: "WorkoutStep",
    stepOrder,
    intensity: exercise.warmUp ? "WARMUP" : "INTERVAL",
    description,
    durationType: duration.durationType,
    durationValue: duration.durationValue,
    durationValueType: null,
    targetType: "OPEN",
    targetValue: null,
    targetValueLow: null,
    targetValueHigh: null,
    targetValueType: null,
    strokeType: null,
    equipmentType: null,
    exerciseCategory: inferGarminExerciseCategory(exerciseName),
    exerciseName,
    weightValue: null,
    weightDisplayUnit: null,
  };
}

function expandBlocksToGarminSteps(
  blocks: readonly BlockInput[],
  movementMap: ReadonlyMap<string, MovementLookup>,
): GarminWorkoutStep[] {
  const steps: GarminWorkoutStep[] = [];

  for (const block of blocks) {
    const maxRounds = Math.max(...block.exercises.map((exercise) => Math.floor(exercise.sets)), 0);
    for (let round = 1; round <= maxRounds; round += 1) {
      for (const exercise of block.exercises) {
        if (round > Math.floor(exercise.sets)) continue;
        const stepOrder = steps.length + 1;
        if (exercise.movementId === TONAL_REST_MOVEMENT_ID) {
          steps.push(buildRestStep(stepOrder, exercise));
          continue;
        }
        steps.push(
          buildExerciseStep({
            stepOrder,
            exercise,
            movement: movementMap.get(exercise.movementId),
            round,
          }),
        );
      }
    }
  }

  return steps;
}

function movementsToIdLookup(movements: readonly Movement[]): Map<string, MovementLookup> {
  return new Map(
    movements.map((movement) => [
      movement.id,
      {
        name: movement.name,
        countReps: movement.countReps,
        isAlternating: movement.isAlternating,
      },
    ]),
  );
}

export function buildGarminStrengthWorkoutPayloadFromPlan({
  workoutPlanId,
  title,
  blocks,
  movements,
  scheduledDate,
}: {
  workoutPlanId: string;
  title: string;
  blocks: readonly BlockInput[];
  movements: readonly Movement[];
  scheduledDate: string;
}): GarminWorkoutPayload {
  const steps = expandBlocksToGarminSteps(blocks, movementsToIdLookup(movements));
  if (steps.length === 0) throw new Error("Workout has no exercises to send to Garmin");

  return {
    workoutName: truncate(title, MAX_WORKOUT_NAME_LENGTH),
    description: truncate(`Roni workout scheduled for ${scheduledDate}.`, MAX_DESCRIPTION_LENGTH),
    sport: "STRENGTH_TRAINING",
    workoutProvider: GARMIN_WORKOUT_PROVIDER,
    workoutSourceId: `roni:${workoutPlanId}`,
    steps,
  };
}
