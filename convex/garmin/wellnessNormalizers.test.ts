import { describe, expect, it } from "vitest";
import {
  extractFirstUserIdFromWellness,
  normalizeDailies,
  normalizeHrv,
  normalizeSleeps,
  normalizeStressDetails,
} from "./wellnessNormalizers";

// Fixtures condensed from Health API V1.2.3 examples (§7.1, §7.3, §7.5,
// §7.10). Only `userId` values are invented so we don't check examples
// in to source.

describe("normalizeDailies", () => {
  const payload = {
    dailies: [
      {
        userId: "u1",
        summaryId: "EXAMPLE_67891",
        calendarDate: "2016-01-11",
        steps: 4210,
        distanceInMeters: 3146.5,
        activeKilocalories: 321,
        bmrKilocalories: 1731,
        durationInSeconds: 86400,
        moderateIntensityDurationInSeconds: 81870,
        vigorousIntensityDurationInSeconds: 4530,
        restingHeartRateInBeatsPerMinute: 58,
        averageStressLevel: 43,
        maxStressLevel: 87,
        bodyBatteryChargedValue: 40,
        bodyBatteryDrainedValue: 20,
      },
    ],
  };

  it("maps every Activity API Daily Summary field we care about", () => {
    const [row] = normalizeDailies(payload);
    expect(row.calendarDate).toBe("2016-01-11");
    expect(row.fields).toEqual({
      steps: 4210,
      distanceMeters: 3146.5,
      activeKilocalories: 321,
      bmrKilocalories: 1731,
      restingHeartRate: 58,
      moderateIntensityMinutes: Math.round(81870 / 60),
      vigorousIntensityMinutes: Math.round(4530 / 60),
      avgStress: 43,
      maxStress: 87,
      bodyBatteryCharged: 40,
      bodyBatteryDrained: 20,
    });
  });

  it("returns empty array on malformed envelopes", () => {
    expect(normalizeDailies(null)).toEqual([]);
    expect(normalizeDailies({})).toEqual([]);
    expect(normalizeDailies({ dailies: "nope" })).toEqual([]);
  });

  it("skips entries without a calendarDate", () => {
    const rows = normalizeDailies({
      dailies: [{ userId: "u", steps: 100 }, payload.dailies[0]],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].calendarDate).toBe("2016-01-11");
  });
});

describe("normalizeSleeps", () => {
  const payload = {
    sleeps: [
      {
        userId: "u1",
        summaryId: "EXAMPLE_567890",
        calendarDate: "2016-01-10",
        durationInSeconds: 15264,
        startTimeInSeconds: 1452419581,
        startTimeOffsetInSeconds: 7200,
        deepSleepDurationInSeconds: 11231,
        lightSleepDurationInSeconds: 3541,
        remSleepInSeconds: 0,
        awakeDurationInSeconds: 492,
        overallSleepScore: { value: 87, qualifierKey: "GOOD" },
      },
    ],
  };

  it("maps sleep phases and sleepScore.value", () => {
    const [row] = normalizeSleeps(payload);
    expect(row.calendarDate).toBe("2016-01-10");
    expect(row.fields.sleepDurationSeconds).toBe(15264);
    expect(row.fields.deepSleepSeconds).toBe(11231);
    expect(row.fields.lightSleepSeconds).toBe(3541);
    expect(row.fields.remSleepSeconds).toBe(0);
    expect(row.fields.awakeSeconds).toBe(492);
    expect(row.fields.sleepScore).toBe(87);
  });

  it("derives sleepStartTime and sleepEndTime as ISO strings", () => {
    const [row] = normalizeSleeps(payload);
    expect(row.fields.sleepStartTime).toBe(new Date(1452419581 * 1000).toISOString());
    expect(row.fields.sleepEndTime).toBe(new Date((1452419581 + 15264) * 1000).toISOString());
  });

  it("leaves sleepEndTime undefined when duration is missing", () => {
    const [row] = normalizeSleeps({
      sleeps: [
        {
          calendarDate: "2020-01-01",
          startTimeInSeconds: 1000,
        },
      ],
    });
    expect(row.fields.sleepEndTime).toBeUndefined();
    expect(row.fields.sleepStartTime).toBe(new Date(1000_000).toISOString());
  });
});

describe("normalizeHrv", () => {
  it("reads lastNightAvg", () => {
    const payload = {
      hrv: [
        {
          userId: "u1",
          summaryId: "x473db21",
          calendarDate: "2022-05-31",
          lastNightAvg: 44,
          lastNight5MinHigh: 72,
          hrvValues: { "300": 32, "600": 24 },
        },
      ],
    };
    const [row] = normalizeHrv(payload);
    expect(row.calendarDate).toBe("2022-05-31");
    expect(row.fields.hrvLastNightAvg).toBe(44);
  });

  it("returns empty when lastNightAvg is missing", () => {
    const rows = normalizeHrv({
      hrv: [{ calendarDate: "2022-05-31", hrvValues: {} }],
    });
    // Still returns one entry — downstream upsert guards on hasAnyField.
    expect(rows).toHaveLength(1);
    expect(rows[0].fields.hrvLastNightAvg).toBeUndefined();
  });
});

describe("normalizeStressDetails", () => {
  it("computes bodyBattery high/low from timeOffsetBodyBatteryValues", () => {
    const payload = {
      stressDetails: [
        {
          userId: "u1",
          summaryId: "x-stress",
          calendarDate: "2024-03-10",
          timeOffsetBodyBatteryValues: {
            "0": 55,
            "180": 56,
            "360": 59,
            "540": 42,
          },
        },
      ],
    };
    const [row] = normalizeStressDetails(payload);
    expect(row.fields.bodyBatteryHighestValue).toBe(59);
    expect(row.fields.bodyBatteryLowestValue).toBe(42);
  });

  it("leaves high/low undefined when the map is missing or empty", () => {
    const rows = normalizeStressDetails({
      stressDetails: [{ calendarDate: "2024-03-10" }],
    });
    expect(rows[0].fields.bodyBatteryHighestValue).toBeUndefined();
    expect(rows[0].fields.bodyBatteryLowestValue).toBeUndefined();
  });

  it("ignores non-numeric values in the map", () => {
    const rows = normalizeStressDetails({
      stressDetails: [
        {
          calendarDate: "2024-03-10",
          timeOffsetBodyBatteryValues: { "0": 50, "60": "oops", "120": null, "180": 60 },
        },
      ],
    });
    expect(rows[0].fields.bodyBatteryHighestValue).toBe(60);
    expect(rows[0].fields.bodyBatteryLowestValue).toBe(50);
  });
});

describe("extractFirstUserIdFromWellness", () => {
  it("reads the first entry's userId from any summary envelope", () => {
    const payload = { dailies: [{ userId: "abc", calendarDate: "2024-01-01" }] };
    expect(extractFirstUserIdFromWellness("dailies", payload)).toBe("abc");
  });

  it("returns null when the envelope is missing", () => {
    expect(extractFirstUserIdFromWellness("dailies", {})).toBeNull();
    expect(extractFirstUserIdFromWellness("dailies", null)).toBeNull();
    expect(extractFirstUserIdFromWellness("dailies", { dailies: [] })).toBeNull();
  });
});
