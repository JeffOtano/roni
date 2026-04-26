/**
 * Upsert-merge persistence for Garmin wellness rows.
 *
 * Four separate Health API summary types (dailies, sleeps, stressDetails,
 * hrv) can all contribute to the same (userId, calendarDate) wellness
 * row. Each push delivers a partial set of fields; this mutation patches
 * only the fields the caller provides, leaving earlier-written fields
 * from other summary types intact. Garmin may also resend an updated
 * summary later in the day — that path just rewrites the fields it owns.
 */

import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";

type WellnessDailyPatch = Partial<
  Omit<Doc<"garminWellnessDaily">, "_creationTime" | "_id" | "calendarDate" | "userId">
>;
type BodyBatteryExtrema = Pick<
  Doc<"garminWellnessDaily">,
  "bodyBatteryHighestValue" | "bodyBatteryLowestValue"
>;

export const MAX_RECENT_WELLNESS_DAILY_ROWS = 30;

const patchValidator = v.object({
  sleepDurationSeconds: v.optional(v.number()),
  deepSleepSeconds: v.optional(v.number()),
  lightSleepSeconds: v.optional(v.number()),
  remSleepSeconds: v.optional(v.number()),
  awakeSeconds: v.optional(v.number()),
  sleepStartTime: v.optional(v.string()),
  sleepEndTime: v.optional(v.string()),
  sleepScore: v.optional(v.number()),

  restingHeartRate: v.optional(v.number()),
  avgStress: v.optional(v.number()),
  maxStress: v.optional(v.number()),
  hrvLastNightAvg: v.optional(v.number()),
  hrvStatus: v.optional(v.string()),
  bodyBatteryCharged: v.optional(v.number()),
  bodyBatteryDrained: v.optional(v.number()),
  bodyBatteryHighestValue: v.optional(v.number()),
  bodyBatteryLowestValue: v.optional(v.number()),

  steps: v.optional(v.number()),
  distanceMeters: v.optional(v.number()),
  activeKilocalories: v.optional(v.number()),
  bmrKilocalories: v.optional(v.number()),
  moderateIntensityMinutes: v.optional(v.number()),
  vigorousIntensityMinutes: v.optional(v.number()),

  vo2Max: v.optional(v.number()),
  vo2MaxCycling: v.optional(v.number()),
  fitnessAge: v.optional(v.number()),
  fitnessAgeEnhanced: v.optional(v.boolean()),
  avgRespirationRate: v.optional(v.number()),
  avgSpo2: v.optional(v.number()),
  skinTempDeviationCelsius: v.optional(v.number()),
});

export function compactWellnessFields(fields: WellnessDailyPatch): WellnessDailyPatch {
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined),
  ) as WellnessDailyPatch;
}

export function mergeWellnessFields(
  existing: BodyBatteryExtrema | null | undefined,
  fields: WellnessDailyPatch,
): WellnessDailyPatch {
  const compactedFields = compactWellnessFields(fields);
  if (!existing) return compactedFields;

  const incomingHigh = compactedFields.bodyBatteryHighestValue;
  if (incomingHigh !== undefined && existing.bodyBatteryHighestValue !== undefined) {
    compactedFields.bodyBatteryHighestValue = Math.max(
      existing.bodyBatteryHighestValue,
      incomingHigh,
    );
  }

  const incomingLow = compactedFields.bodyBatteryLowestValue;
  if (incomingLow !== undefined && existing.bodyBatteryLowestValue !== undefined) {
    compactedFields.bodyBatteryLowestValue = Math.min(existing.bodyBatteryLowestValue, incomingLow);
  }

  return compactedFields;
}

export const upsertWellnessDaily = internalMutation({
  args: {
    userId: v.id("users"),
    entries: v.array(
      v.object({
        calendarDate: v.string(),
        fields: patchValidator,
      }),
    ),
  },
  handler: async (ctx, { userId, entries }) => {
    const now = Date.now();
    for (const { calendarDate, fields } of entries) {
      // Skip patches with no populated fields (e.g. stressDetails with an
      // empty body-battery map) so we don't churn lastIngestedAt for rows
      // whose real data is already correct.
      const incomingFields = compactWellnessFields(fields);
      if (Object.keys(incomingFields).length === 0) continue;

      const existing = await ctx.db
        .query("garminWellnessDaily")
        .withIndex("by_userId_calendarDate", (q) =>
          q.eq("userId", userId).eq("calendarDate", calendarDate),
        )
        .unique();

      const compactedFields = mergeWellnessFields(existing, incomingFields);

      if (existing) {
        await ctx.db.patch(existing._id, { ...compactedFields, lastIngestedAt: now });
      } else {
        await ctx.db.insert("garminWellnessDaily", {
          userId,
          calendarDate,
          ...compactedFields,
          lastIngestedAt: now,
        });
      }
    }
  },
});

export const getRecentWellnessDaily = internalQuery({
  args: {
    userId: v.id("users"),
    limit: v.number(),
  },
  handler: async (ctx, { userId, limit }) => {
    return await ctx.db
      .query("garminWellnessDaily")
      .withIndex("by_userId_calendarDate", (q) => q.eq("userId", userId))
      .order("desc")
      .take(Math.max(0, Math.min(limit, MAX_RECENT_WELLNESS_DAILY_ROWS)));
  },
});
