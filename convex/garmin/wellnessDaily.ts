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
import { internalMutation } from "../_generated/server";

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
});

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
      const hasAnyField = Object.values(fields).some((v) => v !== undefined);
      if (!hasAnyField) continue;

      const existing = await ctx.db
        .query("garminWellnessDaily")
        .withIndex("by_userId_calendarDate", (q) =>
          q.eq("userId", userId).eq("calendarDate", calendarDate),
        )
        .unique();

      if (existing) {
        await ctx.db.patch(existing._id, { ...fields, lastIngestedAt: now });
      } else {
        await ctx.db.insert("garminWellnessDaily", {
          userId,
          calendarDate,
          ...fields,
          lastIngestedAt: now,
        });
      }
    }
  },
});
