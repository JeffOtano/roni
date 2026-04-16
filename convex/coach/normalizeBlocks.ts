/**
 * Defensive normalization of workout blocks against the movement catalog.
 *
 * Guarantees that persisted blocks have rep/duration fields that match the
 * movement's countReps flag — regardless of which code path produced them.
 * Protects against drift from tool-argument passthrough or stale catalog maps.
 */

import type { MutationCtx } from "../_generated/server";

const DEFAULT_REPS = 10;
const DEFAULT_DURATION_SECONDS = 30;

interface ExerciseShape {
  movementId: string;
  sets: number;
  reps?: number;
  duration?: number;
  spotter?: boolean;
  eccentric?: boolean;
  chains?: boolean;
  burnout?: boolean;
  dropSet?: boolean;
  warmUp?: boolean;
}

interface BlockShape {
  exercises: ExerciseShape[];
}

/**
 * Pure normalization: given blocks and a map of movementId -> countReps,
 * force each exercise into rep-based or duration-based shape.
 * Missing catalog entries are left untouched.
 */
export function normalizeBlocksWithCountReps(
  blocks: BlockShape[],
  countRepsByMovement: Map<string, boolean>,
): BlockShape[] {
  return blocks.map((block) => ({
    ...block,
    exercises: block.exercises.map((ex) => {
      const countReps = countRepsByMovement.get(ex.movementId);
      if (countReps === undefined) return ex;
      if (countReps) {
        return { ...ex, reps: ex.reps ?? DEFAULT_REPS, duration: undefined };
      }
      return { ...ex, duration: ex.duration ?? DEFAULT_DURATION_SECONDS, reps: undefined };
    }),
  }));
}

export async function normalizeBlocksAgainstCatalog(
  ctx: MutationCtx,
  blocks: BlockShape[],
): Promise<BlockShape[]> {
  const allMovements = await ctx.db.query("movements").collect();
  const countRepsByMovement = new Map<string, boolean>();
  for (const doc of allMovements) {
    countRepsByMovement.set(doc.tonalId, doc.countReps);
  }
  return normalizeBlocksWithCountReps(blocks, countRepsByMovement);
}
