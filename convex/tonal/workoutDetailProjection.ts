import { z } from "zod";
import type { WorkoutActivityDetail } from "./types";

// Convex caps array fields at 8192 elements. Tonal can return thousands of
// set entries for some activities, and the raw payload contains additional
// undeclared array fields that can also exceed the cap.
const MAX_SETS_RETURN = 4000;

const setActivitySchema = z.object({
  id: z.string(),
  movementId: z.string(),
  prescribedReps: z.number(),
  repetition: z.number(),
  repetitionTotal: z.number(),
  blockNumber: z.number(),
  spotter: z.boolean(),
  eccentric: z.boolean(),
  chains: z.boolean(),
  flex: z.boolean(),
  warmUp: z.boolean(),
  beginTime: z.string(),
  sideNumber: z.number(),
  weightPercentage: z.number().optional(),
  avgWeight: z.number().optional(),
  baseWeight: z.number().optional(),
  volume: z.number().optional(),
  repCount: z.number().optional(),
  oneRepMax: z.number().optional(),
});

const workoutActivityDetailSchema = z.object({
  id: z.string(),
  userId: z.string(),
  workoutId: z.string(),
  workoutType: z.string(),
  timezone: z.string(),
  beginTime: z.string(),
  endTime: z.string(),
  totalDuration: z.number(),
  activeDuration: z.number(),
  restDuration: z.number(),
  totalMovements: z.number(),
  totalSets: z.number(),
  totalReps: z.number(),
  totalVolume: z.number(),
  totalConcentricWork: z.number(),
  percentCompleted: z.number(),
  workoutSetActivity: z.array(setActivitySchema).optional(),
});

/**
 * Parse a raw /v6/users/{id}/workout-activities/{id} response into the declared
 * WorkoutActivityDetail shape. Strips undeclared fields (which may contain
 * oversized arrays that fail Convex's 8192-element validator) and caps
 * workoutSetActivity at MAX_SETS_RETURN.
 */
export function projectWorkoutDetail(raw: unknown): WorkoutActivityDetail | null {
  if (raw === null || raw === undefined) return null;
  const result = workoutActivityDetailSchema.safeParse(raw);
  if (!result.success) {
    console.warn("projectWorkoutDetail: schema mismatch", result.error.issues);
    return null;
  }

  const detail = result.data;
  const sets = detail.workoutSetActivity;
  if (!sets || sets.length <= MAX_SETS_RETURN) return detail;

  console.warn(
    `projectWorkoutDetail: capped workoutSetActivity (${sets.length} -> ${MAX_SETS_RETURN}) for activity ${detail.id}`,
  );
  return { ...detail, workoutSetActivity: sets.slice(0, MAX_SETS_RETURN) };
}
