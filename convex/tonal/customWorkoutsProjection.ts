import { z } from "zod";
import type { UserWorkout } from "./types";

const userWorkoutSchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  title: z.string(),
  shortDescription: z.string(),
  description: z.string(),
  duration: z.number(),
  level: z.string(),
  targetArea: z.string(),
  tags: z.array(z.string()),
  bodyRegions: z.array(z.string()),
  type: z.string(),
  userId: z.string(),
  style: z.string(),
  trainingType: z.string(),
  movementIds: z.array(z.string()),
  accessories: z.array(z.string()),
  playbackType: z.string(),
  isImported: z.boolean(),
});

const customWorkoutsSchema = z.array(userWorkoutSchema);

/**
 * Project a raw /v6/user-workouts response down to the declared UserWorkout
 * shape. Tonal returns expanded set/block payloads inside each workout that
 * are never read here — Zod's strip behavior drops them so we don't store
 * thousands of nested objects per cached entry.
 */
export function projectCustomWorkouts(raw: unknown): UserWorkout[] {
  if (!Array.isArray(raw)) return [];
  const result = customWorkoutsSchema.safeParse(raw);
  if (!result.success) {
    console.warn("projectCustomWorkouts: schema mismatch", result.error.issues);
    return [];
  }
  return result.data;
}

/**
 * Strict variant for fresh API responses: throws on schema mismatch so
 * `cachedFetch` can fall back to stale data instead of caching an empty
 * placeholder that would mask upstream drift for the full TTL.
 */
export function projectCustomWorkoutsStrict(raw: unknown): UserWorkout[] {
  if (!Array.isArray(raw)) {
    throw new Error(
      `projectCustomWorkoutsStrict: expected array, got ${raw === null ? "null" : typeof raw}`,
    );
  }
  return customWorkoutsSchema.parse(raw);
}
