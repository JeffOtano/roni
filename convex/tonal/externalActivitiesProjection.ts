import { z } from "zod";
import type { ExternalActivity } from "./types";

const externalActivitySchema = z.object({
  workoutType: z.string(),
  beginTime: z.string(),
  totalDuration: z.number(),
  distance: z.number(),
  activeCalories: z.number(),
  totalCalories: z.number(),
  averageHeartRate: z.number(),
  source: z.string(),
  externalId: z.string(),
});

const externalActivitiesSchema = z.array(externalActivitySchema);

/**
 * Project a raw /v6/users/{id}/external-activities response down to the fields
 * readers consume (DB persistence, vigorous-load trigger). Drops the per-row
 * `id`, `userId`, `endTime`, `timezone`, `activeDuration`, and `deviceId`,
 * none of which are read anywhere downstream.
 */
export function projectExternalActivities(raw: unknown): ExternalActivity[] {
  if (!Array.isArray(raw)) return [];
  const result = externalActivitiesSchema.safeParse(raw);
  if (!result.success) {
    console.warn("projectExternalActivities: schema mismatch", result.error.issues);
    return [];
  }
  // Cast through unknown: the projected shape covers every field readers touch
  // even though the declared type still mentions the dropped ones.
  return result.data as unknown as ExternalActivity[];
}

/**
 * Strict variant for fresh API responses: throws on schema mismatch so
 * `cachedFetch` can fall back to stale data instead of caching an empty
 * placeholder that would mask upstream drift for the full TTL.
 */
export function projectExternalActivitiesStrict(raw: unknown): ExternalActivity[] {
  if (!Array.isArray(raw)) {
    throw new Error(
      `projectExternalActivitiesStrict: expected array, got ${raw === null ? "null" : typeof raw}`,
    );
  }
  return externalActivitiesSchema.parse(raw) as unknown as ExternalActivity[];
}
