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

export function expandBlocksToSets(blocks: BlockInput[]): WorkoutSetInput[] {
  const allSets: WorkoutSetInput[] = [];

  for (let blockIdx = 0; blockIdx < blocks.length; blockIdx++) {
    const block = blocks[blockIdx];
    const blockNumber = blockIdx + 1;
    const maxRounds = Math.max(...block.exercises.map((e) => e.sets));
    let isFirstInBlock = true;

    for (let round = 1; round <= maxRounds; round++) {
      for (let exIdx = 0; exIdx < block.exercises.length; exIdx++) {
        const ex = block.exercises[exIdx];
        if (round > ex.sets) continue;

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

        allSets.push(set);
        isFirstInBlock = false;
      }
    }
  }

  return allSets;
}
