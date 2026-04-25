import { z } from "zod";
import type { FormattedWorkoutSummary } from "./types";

const movementSetSchema = z.object({
  movementId: z.string(),
  totalVolume: z.number(),
});

const formattedSummarySchema = z.object({
  movementSets: z.array(movementSetSchema).optional(),
});

/**
 * Project a raw /v6/formatted/users/{id}/workout-summaries/{id} response down
 * to the per-movement totalVolume readers actually use. Drops the per-movement
 * `sets` array (Tonal returns one entry per rep, easily tens of thousands of
 * elements) plus unused totals so cached entries stop crowding the 1 MiB cap.
 */
export function projectFormattedSummary(raw: unknown): FormattedWorkoutSummary {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { movementSets: [] };
  }
  const result = formattedSummarySchema.safeParse(raw);
  if (!result.success) {
    console.warn("projectFormattedSummary: schema mismatch", result.error.issues);
    return { movementSets: [] };
  }
  return { movementSets: result.data.movementSets ?? [] };
}
