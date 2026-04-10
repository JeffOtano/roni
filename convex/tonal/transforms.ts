import type { WorkoutSetInput } from "./types";

/** Well-known Tonal movement ID for rest periods between sets. */
export const TONAL_REST_MOVEMENT_ID = "00000000-0000-0000-0000-000000000005";

export interface ExerciseInput {
  movementId: string;
  sets: number;
  reps?: number;
  duration?: number;
  warmUp?: boolean;
  spotter?: boolean;
  eccentric?: boolean;
  chains?: boolean;
  burnout?: boolean;
  dropSet?: boolean;
}

export interface BlockInput {
  exercises: ExerciseInput[];
}

/** Optional movement catalog for auto-correcting duration vs reps and alternating rep counts. */
export interface MovementCatalogEntry {
  id: string;
  countReps: boolean;
  isAlternating: boolean;
  muscleGroups?: string[];
}

interface BuildSetOpts {
  ex: ExerciseInput;
  blockNumber: number;
  exIdx: number;
  round: number;
  isFirstInBlock: boolean;
  /** If provided, auto-corrects duration vs reps based on countReps. */
  movementMap?: Map<string, MovementCatalogEntry>;
}

const DEFAULT_DURATION_SECONDS = 30;

function buildSet({
  ex,
  blockNumber,
  exIdx,
  round,
  isFirstInBlock,
  movementMap,
}: BuildSetOpts): WorkoutSetInput {
  const set: WorkoutSetInput = {
    blockStart: isFirstInBlock,
    movementId: ex.movementId,
    blockNumber,
    setGroup: exIdx + 1,
    round,
    repetition: round,
    repetitionTotal: ex.sets,
    burnout: ex.burnout ?? false,
    spotter: ex.spotter ?? false,
    eccentric: ex.eccentric ?? false,
    chains: ex.chains ?? false,
    flex: false,
    warmUp: ex.warmUp ?? false,
    dropSet: ex.dropSet ?? false,
    weightPercentage: 100,
    description: "",
  };

  // Auto-correct based on movement catalog if available
  const movement = movementMap?.get(ex.movementId);
  const isDurationBased = movement ? !movement.countReps : false;

  if (isDurationBased || ex.duration) {
    set.prescribedDuration = ex.duration ?? DEFAULT_DURATION_SECONDS;
    set.prescribedResistanceLevel = 5;
  } else {
    const baseReps = ex.reps ?? 10;
    // Tonal counts total reps for alternating exercises (5 per side = 10 total).
    // AI prescribes per-side reps, so double for alternating movements.
    const isAlternating = movement?.isAlternating ?? false;
    set.prescribedReps = isAlternating ? baseReps * 2 : baseReps;
  }

  return set;
}

function expandBlock(
  block: BlockInput,
  blockNumber: number,
  startIdx: number,
  movementMap?: Map<string, MovementCatalogEntry>,
): WorkoutSetInput[] {
  const sets: WorkoutSetInput[] = [];
  const maxRounds = Math.max(...block.exercises.map((e) => e.sets));

  for (let round = 1; round <= maxRounds; round++) {
    for (let exIdx = 0; exIdx < block.exercises.length; exIdx++) {
      const ex = block.exercises[exIdx];
      if (round > ex.sets) continue;
      sets.push(
        buildSet({
          ex,
          blockNumber,
          exIdx,
          round,
          isFirstInBlock: startIdx + sets.length === 0,
          movementMap,
        }),
      );
    }
  }

  // Mark first set of this block
  if (sets.length > 0) sets[0] = { ...sets[0], blockStart: true };
  return sets;
}

/**
 * Expand block inputs into flat workout sets for the Tonal API.
 * If a movement catalog is provided, auto-corrects duration vs reps based on countReps.
 */
export function expandBlocksToSets(
  blocks: BlockInput[],
  catalog?: MovementCatalogEntry[],
): WorkoutSetInput[] {
  const movementMap = catalog ? new Map(catalog.map((m) => [m.id, m])) : undefined;
  return blocks.flatMap((block, blockIdx) =>
    expandBlock(block, blockIdx + 1, blockIdx, movementMap),
  );
}
