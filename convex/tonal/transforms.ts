import type { WorkoutSetInput } from "./types";

export interface ExerciseInput {
  movementId: string;
  sets: number;
  reps?: number;
  duration?: number;
  warmUp?: boolean;
  spotter?: boolean;
  eccentric?: boolean;
}

export interface BlockInput {
  exercises: ExerciseInput[];
}

interface BuildSetOpts {
  ex: ExerciseInput;
  blockNumber: number;
  exIdx: number;
  round: number;
  isFirstInBlock: boolean;
}

function buildSet({
  ex,
  blockNumber,
  exIdx,
  round,
  isFirstInBlock,
}: BuildSetOpts): WorkoutSetInput {
  const set: WorkoutSetInput = {
    blockStart: isFirstInBlock,
    movementId: ex.movementId,
    blockNumber,
    setGroup: exIdx + 1,
    round,
    repetition: round,
    repetitionTotal: ex.sets,
    burnout: false,
    spotter: ex.spotter ?? false,
    eccentric: ex.eccentric ?? false,
    chains: false,
    flex: false,
    warmUp: ex.warmUp ?? false,
    dropSet: false,
    weightPercentage: 100,
    description: "",
  };

  if (ex.duration) {
    set.prescribedDuration = ex.duration;
    set.prescribedResistanceLevel = 5;
  } else {
    set.prescribedReps = ex.reps ?? 10;
  }

  return set;
}

function expandBlock(block: BlockInput, blockNumber: number, startIdx: number): WorkoutSetInput[] {
  const sets: WorkoutSetInput[] = [];
  const maxRounds = Math.max(...block.exercises.map((e) => e.sets));

  for (let round = 1; round <= maxRounds; round++) {
    for (let exIdx = 0; exIdx < block.exercises.length; exIdx++) {
      const ex = block.exercises[exIdx];
      if (round > ex.sets) continue;
      sets.push(
        buildSet({ ex, blockNumber, exIdx, round, isFirstInBlock: startIdx + sets.length === 0 }),
      );
    }
  }

  // Mark first set of this block
  if (sets.length > 0) sets[0] = { ...sets[0], blockStart: true };
  return sets;
}

export function expandBlocksToSets(blocks: BlockInput[]): WorkoutSetInput[] {
  return blocks.flatMap((block, blockIdx) => expandBlock(block, blockIdx + 1, blockIdx));
}
