/**
 * Garmin Activity API push payload normalizer.
 *
 * Converts the envelope Garmin posts to /garmin/webhook/activities
 * into our generalized `externalActivities` insert shape. Pure
 * function — no I/O, unit-tested against fixtures.
 *
 * Field names follow the Activity API V1.2.4 §7.1 spec. Missing
 * optional fields map to undefined so the generalized validator
 * (convex/tonal/historySyncMutations.ts `externalActivityValidator`)
 * accepts them.
 */

const MINUTES_TO_SECONDS = 60;

export interface NormalizedGarminActivity {
  externalId: string;
  workoutType: string;
  beginTime: string;
  totalDuration: number;
  source: "garmin";
  activeCalories?: number;
  /** Garmin Activity summaries provide active kilocalories, not total calories. */
  totalCalories?: number;
  averageHeartRate?: number;
  maxHeartRate?: number;
  distance?: number;
  elevationGainMeters?: number;
  avgPaceSecondsPerKm?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/**
 * Pull the first `userId` from a Garmin push envelope for the given
 * summary type (e.g. `payload.activities[0].userId`). Returns null on
 * any shape mismatch.
 */
export function extractFirstUserIdFromSummary(
  summaryType: string,
  rawPayload: unknown,
): string | null {
  if (!isRecord(rawPayload)) return null;
  const list = rawPayload[summaryType];
  if (!Array.isArray(list) || list.length === 0) return null;
  const first = list[0];
  if (!isRecord(first)) return null;
  return typeof first.userId === "string" ? first.userId : null;
}

/**
 * Normalize every activity summary in a Garmin push payload.
 * Entries missing the handful of required fields
 * (`summaryId` / `activityType` / `startTimeInSeconds` /
 * `durationInSeconds`) are skipped rather than corrupting the row.
 */
export function normalizeGarminActivities(rawPayload: unknown): NormalizedGarminActivity[] {
  if (!isRecord(rawPayload)) return [];
  const activities = rawPayload.activities;
  if (!Array.isArray(activities)) return [];
  return activities.flatMap((entry) => {
    const normalized = normalizeOne(entry);
    return normalized ? [normalized] : [];
  });
}

function normalizeOne(entry: unknown): NormalizedGarminActivity | null {
  if (!isRecord(entry)) return null;

  const summaryId = entry.summaryId;
  const activityType = entry.activityType;
  const startTime = entry.startTimeInSeconds;
  const duration = entry.durationInSeconds;
  if (typeof summaryId !== "string") return null;
  if (typeof activityType !== "string") return null;
  if (typeof startTime !== "number" || !Number.isFinite(startTime)) return null;
  if (typeof duration !== "number" || !Number.isFinite(duration)) return null;

  const pace = optionalNumber(entry.averagePaceInMinutesPerKilometer);

  return {
    externalId: summaryId,
    workoutType: activityType,
    beginTime: new Date(startTime * 1000).toISOString(),
    totalDuration: duration,
    source: "garmin",
    activeCalories: optionalNumber(entry.activeKilocalories),
    averageHeartRate: optionalNumber(entry.averageHeartRateInBeatsPerMinute),
    maxHeartRate: optionalNumber(entry.maxHeartRateInBeatsPerMinute),
    distance: optionalNumber(entry.distanceInMeters),
    elevationGainMeters: optionalNumber(entry.totalElevationGainInMeters),
    avgPaceSecondsPerKm: pace !== undefined ? pace * MINUTES_TO_SECONDS : undefined,
  };
}
