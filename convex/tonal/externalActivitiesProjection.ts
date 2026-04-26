import { z } from "zod";
import {
  type ExternalActivitySource,
  normalizeExternalActivitySource,
} from "./externalActivitySources";
import type { ExternalActivity } from "./types";

const externalActivitySchema = z.object({
  workoutType: z.string(),
  beginTime: z.string(),
  totalDuration: z.number(),
  distance: z.number(),
  activeCalories: z.number(),
  totalCalories: z.number(),
  averageHeartRate: z.number(),
  source: z.string().transform(normalizeExternalActivitySource),
  externalId: z.string(),
});

const externalActivitiesSchema = z.array(externalActivitySchema);

/**
 * Subset of `ExternalActivity` that survives projection. Readers on the proxy
 * cache path receive this narrower type so a future caller of dropped fields
 * (`id`, `userId`, `endTime`, `timezone`, `activeDuration`, `deviceId`) gets a
 * compile error instead of silently reading `undefined` at runtime.
 */
export type ProjectedExternalActivity = Pick<
  ExternalActivity,
  | "workoutType"
  | "beginTime"
  | "totalDuration"
  | "distance"
  | "activeCalories"
  | "totalCalories"
  | "averageHeartRate"
  | "externalId"
> & {
  source: ExternalActivitySource;
};

/**
 * Project a raw /v6/users/{id}/external-activities response down to the fields
 * readers consume (DB persistence, vigorous-load trigger). Drops the per-row
 * `id`, `userId`, `endTime`, `timezone`, `activeDuration`, and `deviceId`,
 * none of which are read anywhere downstream.
 */
export function projectExternalActivities(raw: unknown): ProjectedExternalActivity[] {
  if (!Array.isArray(raw)) return [];
  const result = externalActivitiesSchema.safeParse(raw);
  if (!result.success) {
    console.warn("projectExternalActivities: schema mismatch", result.error.issues);
    return [];
  }
  return result.data;
}

/**
 * Strict variant for fresh API responses: throws on schema mismatch so
 * `cachedFetch` can fall back to stale data instead of caching an empty
 * placeholder that would mask upstream drift for the full TTL.
 */
export function projectExternalActivitiesStrict(raw: unknown): ProjectedExternalActivity[] {
  if (!Array.isArray(raw)) {
    throw new Error(
      `projectExternalActivitiesStrict: expected array, got ${raw === null ? "null" : typeof raw}`,
    );
  }
  return externalActivitiesSchema.parse(raw);
}
