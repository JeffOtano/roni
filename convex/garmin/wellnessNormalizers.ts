/**
 * Garmin Health API push payload normalizers.
 *
 * Each Push Service payload for a health summary type (dailies, sleeps,
 * stressDetails, hrv) arrives under its own envelope key per Health API
 * V1.2.3 §5.1. We map each entry to a partial `garminWellnessDaily`
 * upsert keyed by (userId, calendarDate) — four summary types can merge
 * into the same calendar-date row as they arrive.
 *
 * Pure functions, unit-tested. Missing optional fields stay undefined
 * so the Convex validator's `v.optional(...)` accepts partial rows.
 */

const SECONDS_PER_MINUTE = 60;

export interface WellnessDailyPartial {
  calendarDate: string;
  fields: WellnessDailyFieldPatch;
}

export interface WellnessDailyFieldPatch {
  // Sleep
  sleepDurationSeconds?: number;
  deepSleepSeconds?: number;
  lightSleepSeconds?: number;
  remSleepSeconds?: number;
  awakeSeconds?: number;
  sleepStartTime?: string;
  sleepEndTime?: string;
  sleepScore?: number;

  // Recovery
  restingHeartRate?: number;
  avgStress?: number;
  maxStress?: number;
  hrvLastNightAvg?: number;
  hrvStatus?: string;
  bodyBatteryCharged?: number;
  bodyBatteryDrained?: number;
  bodyBatteryHighestValue?: number;
  bodyBatteryLowestValue?: number;

  // Activity baseline
  steps?: number;
  distanceMeters?: number;
  activeKilocalories?: number;
  bmrKilocalories?: number;
  moderateIntensityMinutes?: number;
  vigorousIntensityMinutes?: number;

  // Fitness + vital-sign averages
  vo2Max?: number;
  vo2MaxCycling?: number;
  fitnessAge?: number;
  fitnessAgeEnhanced?: boolean;
  avgRespirationRate?: number;
  avgSpo2?: number;
  skinTempDeviationCelsius?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function secondsToMinutes(seconds: number | undefined): number | undefined {
  if (seconds === undefined) return undefined;
  return Math.round(seconds / SECONDS_PER_MINUTE);
}

function unixToIso(unixSeconds: number | undefined): string | undefined {
  if (unixSeconds === undefined) return undefined;
  return new Date(unixSeconds * 1000).toISOString();
}

/**
 * Pull every entry from a summary envelope (e.g. `payload.dailies`) and
 * run the supplied mapper on each. Entries missing the required
 * `calendarDate` string are dropped.
 */
function normalizeSummaryList(
  summaryKey: string,
  rawPayload: unknown,
  map: (entry: Record<string, unknown>) => WellnessDailyFieldPatch | null,
): WellnessDailyPartial[] {
  if (!isRecord(rawPayload)) return [];
  const list = rawPayload[summaryKey];
  if (!Array.isArray(list)) return [];
  return list.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const calendarDate = optionalString(entry.calendarDate);
    if (!calendarDate) return [];
    const fields = map(entry);
    if (!fields) return [];
    return [{ calendarDate, fields }];
  });
}

// ---------------------------------------------------------------------------
// Daily Summaries (§7.1)
// ---------------------------------------------------------------------------

export function normalizeDailies(rawPayload: unknown): WellnessDailyPartial[] {
  return normalizeSummaryList("dailies", rawPayload, (entry) => ({
    steps: optionalNumber(entry.steps),
    distanceMeters: optionalNumber(entry.distanceInMeters),
    activeKilocalories: optionalNumber(entry.activeKilocalories),
    bmrKilocalories: optionalNumber(entry.bmrKilocalories),
    restingHeartRate: optionalNumber(entry.restingHeartRateInBeatsPerMinute),
    moderateIntensityMinutes: secondsToMinutes(
      optionalNumber(entry.moderateIntensityDurationInSeconds),
    ),
    vigorousIntensityMinutes: secondsToMinutes(
      optionalNumber(entry.vigorousIntensityDurationInSeconds),
    ),
    avgStress: optionalNumber(entry.averageStressLevel),
    maxStress: optionalNumber(entry.maxStressLevel),
    bodyBatteryCharged: optionalNumber(entry.bodyBatteryChargedValue),
    bodyBatteryDrained: optionalNumber(entry.bodyBatteryDrainedValue),
  }));
}

// ---------------------------------------------------------------------------
// Sleep Summaries (§7.3)
// ---------------------------------------------------------------------------

function extractSleepScore(entry: Record<string, unknown>): number | undefined {
  const overall = entry.overallSleepScore;
  if (!isRecord(overall)) return undefined;
  return optionalNumber(overall.value);
}

export function normalizeSleeps(rawPayload: unknown): WellnessDailyPartial[] {
  return normalizeSummaryList("sleeps", rawPayload, (entry) => {
    const startTime = optionalNumber(entry.startTimeInSeconds);
    const duration = optionalNumber(entry.durationInSeconds);
    return {
      sleepDurationSeconds: duration,
      deepSleepSeconds: optionalNumber(entry.deepSleepDurationInSeconds),
      lightSleepSeconds: optionalNumber(entry.lightSleepDurationInSeconds),
      remSleepSeconds: optionalNumber(entry.remSleepInSeconds),
      awakeSeconds: optionalNumber(entry.awakeDurationInSeconds),
      sleepStartTime: unixToIso(startTime),
      sleepEndTime:
        startTime !== undefined && duration !== undefined
          ? unixToIso(startTime + duration)
          : undefined,
      sleepScore: extractSleepScore(entry),
    };
  });
}

// ---------------------------------------------------------------------------
// HRV Summaries (§7.10)
// ---------------------------------------------------------------------------

export function normalizeHrv(rawPayload: unknown): WellnessDailyPartial[] {
  return normalizeSummaryList("hrv", rawPayload, (entry) => ({
    hrvLastNightAvg: optionalNumber(entry.lastNightAvg),
  }));
}

// ---------------------------------------------------------------------------
// Stress Details (§7.5)
//
// Dailies already carries avg/max stress + bodyBattery charged/drained for
// the calendar date, so stressDetails' value-add is the minute-level
// `timeOffsetBodyBatteryValues` map we can reduce to highest/lowest.
// ---------------------------------------------------------------------------

function computeBodyBatteryHighLow(entry: Record<string, unknown>): {
  high: number | undefined;
  low: number | undefined;
} {
  const map = entry.timeOffsetBodyBatteryValues;
  if (!isRecord(map)) return { high: undefined, low: undefined };
  let high: number | undefined;
  let low: number | undefined;
  for (const value of Object.values(map)) {
    const n = optionalNumber(value);
    if (n === undefined) continue;
    high = high === undefined || n > high ? n : high;
    low = low === undefined || n < low ? n : low;
  }
  return { high, low };
}

export function normalizeStressDetails(rawPayload: unknown): WellnessDailyPartial[] {
  return normalizeSummaryList("stressDetails", rawPayload, (entry) => {
    const { high, low } = computeBodyBatteryHighLow(entry);
    return {
      bodyBatteryHighestValue: high,
      bodyBatteryLowestValue: low,
    };
  });
}

// ---------------------------------------------------------------------------
// User Metrics (§7.6) — VO2max + fitness age, one value per calendar date
// ---------------------------------------------------------------------------

export function normalizeUserMetrics(rawPayload: unknown): WellnessDailyPartial[] {
  return normalizeSummaryList("userMetrics", rawPayload, (entry) => ({
    vo2Max: optionalNumber(entry.vo2Max),
    vo2MaxCycling: optionalNumber(entry.vo2MaxCycling),
    fitnessAge: optionalNumber(entry.fitnessAge),
    fitnessAgeEnhanced: typeof entry.enhanced === "boolean" ? entry.enhanced : undefined,
  }));
}

// ---------------------------------------------------------------------------
// Pulse Ox (§7.7) — SpO2 samples. We average the continuous measurement
// window into a single daily value. Multiple summaries per day overwrite
// (last-write-wins) which is acceptable for coaching-level trends.
// ---------------------------------------------------------------------------

function averageMapValues(map: unknown): number | undefined {
  if (!isRecord(map)) return undefined;
  let sum = 0;
  let count = 0;
  for (const value of Object.values(map)) {
    const n = optionalNumber(value);
    if (n === undefined) continue;
    sum += n;
    count++;
  }
  return count === 0 ? undefined : sum / count;
}

export function normalizePulseOx(rawPayload: unknown): WellnessDailyPartial[] {
  // Garmin's Push body keys Pulse Ox under "pulseox" (lowercase) even
  // though the webhook URL path + backfill path use "pulseOx".
  return normalizeSummaryList("pulseox", rawPayload, (entry) => ({
    avgSpo2: averageMapValues(entry.timeOffsetSpo2Values),
  }));
}

// ---------------------------------------------------------------------------
// Skin Temperature (§7.12) — per-night average deviation from baseline
// ---------------------------------------------------------------------------

export function normalizeSkinTemp(rawPayload: unknown): WellnessDailyPartial[] {
  return normalizeSummaryList("skinTemp", rawPayload, (entry) => ({
    skinTempDeviationCelsius: optionalNumber(entry.avgDeviationCelsius),
  }));
}

// ---------------------------------------------------------------------------
// Respiration (§7.8) — breaths per minute. Respiration summaries don't
// carry a calendarDate; derive one from startTimeInSeconds +
// startTimeOffsetInSeconds so local-day bucketing is accurate. Multiple
// summaries per day overwrite last-write-wins.
// ---------------------------------------------------------------------------

function localCalendarDate(
  startTimeInSeconds: number | undefined,
  offsetSeconds: number | undefined,
): string | undefined {
  if (startTimeInSeconds === undefined) return undefined;
  const localEpochMs = (startTimeInSeconds + (offsetSeconds ?? 0)) * 1000;
  const iso = new Date(localEpochMs).toISOString();
  return iso.slice(0, 10); // YYYY-MM-DD
}

export function normalizeRespiration(rawPayload: unknown): WellnessDailyPartial[] {
  if (!isRecord(rawPayload)) return [];
  // Garmin's Push body keys respiration under "allDayRespiration"
  // despite the webhook URL path + backfill path being "respiration".
  const list = rawPayload.allDayRespiration;
  if (!Array.isArray(list)) return [];
  return list.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const calendarDate = localCalendarDate(
      optionalNumber(entry.startTimeInSeconds),
      optionalNumber(entry.startTimeOffsetInSeconds),
    );
    if (!calendarDate) return [];
    const avg = averageMapValues(entry.timeOffsetEpochToBreaths);
    if (avg === undefined) return [];
    return [{ calendarDate, fields: { avgRespirationRate: avg } }];
  });
}

/**
 * Map from our webhook-path summary key (which mirrors Garmin's URL +
 * backfill path name) to the key Garmin actually uses inside the Push
 * body envelope. Most types match; Pulse Ox and Respiration diverge.
 */
export const WELLNESS_ENVELOPE_KEYS = {
  dailies: "dailies",
  sleeps: "sleeps",
  stressDetails: "stressDetails",
  hrv: "hrv",
  userMetrics: "userMetrics",
  pulseOx: "pulseox",
  respiration: "allDayRespiration",
  skinTemp: "skinTemp",
} as const;

/**
 * Pull the first `userId` from any health summary envelope. Health API
 * uses the same list-of-entries shape as Activity API, so we can share
 * this helper.
 */
export function extractFirstUserIdFromWellness(
  summaryKey: string,
  rawPayload: unknown,
): string | null {
  if (!isRecord(rawPayload)) return null;
  const list = rawPayload[summaryKey];
  if (!Array.isArray(list) || list.length === 0) return null;
  const first = list[0];
  if (!isRecord(first)) return null;
  return typeof first.userId === "string" ? first.userId : null;
}
