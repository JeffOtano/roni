import { describe, expect, it } from "vitest";
import {
  extractFirstUserIdFromWellness,
  normalizeDailies,
  normalizeHrv,
  normalizePulseOx,
  normalizeRespiration,
  normalizeSkinTemp,
  normalizeSleeps,
  normalizeStressDetails,
  normalizeUserMetrics,
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

describe("normalizeUserMetrics", () => {
  it("maps vo2Max, vo2MaxCycling, fitnessAge, and the enhanced flag", () => {
    const [row] = normalizeUserMetrics({
      userMetrics: [
        {
          userId: "u1",
          summaryId: "EXAMPLE_843244",
          calendarDate: "2017-03-23",
          vo2Max: 48.0,
          vo2MaxCycling: 52.0,
          enhanced: true,
          fitnessAge: 32,
        },
      ],
    });
    expect(row.calendarDate).toBe("2017-03-23");
    expect(row.fields).toEqual({
      vo2Max: 48.0,
      vo2MaxCycling: 52.0,
      fitnessAge: 32,
      fitnessAgeEnhanced: true,
    });
  });

  it("leaves enhanced undefined when the field is missing", () => {
    const [row] = normalizeUserMetrics({
      userMetrics: [{ calendarDate: "2017-03-23", vo2Max: 45 }],
    });
    expect(row.fields.fitnessAgeEnhanced).toBeUndefined();
  });
});

describe("normalizePulseOx", () => {
  it("reads from the 'pulseox' envelope key and averages SpO2 values", () => {
    const [row] = normalizePulseOx({
      pulseox: [
        {
          userId: "u1",
          summaryId: "Example1234",
          calendarDate: "2018-08-27",
          timeOffsetSpo2Values: { "0": 94, "60": 95, "120": 96 },
          onDemand: false,
        },
      ],
    });
    expect(row.calendarDate).toBe("2018-08-27");
    expect(row.fields.avgSpo2).toBeCloseTo(95, 5);
  });

  it("returns empty when the envelope uses the wrong key (e.g. pulseOx)", () => {
    expect(
      normalizePulseOx({
        pulseOx: [{ calendarDate: "2018-08-27", timeOffsetSpo2Values: { "0": 95 } }],
      }),
    ).toEqual([]);
  });

  it("leaves avgSpo2 undefined when the map is absent or all-invalid", () => {
    const [row] = normalizePulseOx({
      pulseox: [{ calendarDate: "2018-08-27", timeOffsetSpo2Values: {} }],
    });
    expect(row.fields.avgSpo2).toBeUndefined();
  });
});

describe("normalizeSkinTemp", () => {
  it("maps avgDeviationCelsius directly", () => {
    const [row] = normalizeSkinTemp({
      skinTemp: [
        {
          userId: "u1",
          summaryId: "example-65f83c38",
          calendarDate: "2024-03-18",
          avgDeviationCelsius: -1.6,
          durationInSeconds: 1980,
        },
      ],
    });
    expect(row.calendarDate).toBe("2024-03-18");
    expect(row.fields.skinTempDeviationCelsius).toBe(-1.6);
  });
});

describe("normalizeRespiration", () => {
  it("reads from the 'allDayRespiration' envelope, derives calendarDate, averages breaths", () => {
    const startUtc = Date.UTC(2019, 8, 11, 0, 0, 0) / 1000;
    const [row] = normalizeRespiration({
      allDayRespiration: [
        {
          userId: "u1",
          summaryId: "x15372ea",
          startTimeInSeconds: startUtc,
          durationInSeconds: 900,
          startTimeOffsetInSeconds: 0,
          timeOffsetEpochToBreaths: { "0": 14, "60": 16, "120": 12 },
        },
      ],
    });
    expect(row.calendarDate).toBe("2019-09-11");
    expect(row.fields.avgRespirationRate).toBeCloseTo(14, 5);
  });

  it("returns empty when the envelope uses the wrong key (e.g. 'respiration')", () => {
    expect(
      normalizeRespiration({
        respiration: [{ startTimeInSeconds: 1, timeOffsetEpochToBreaths: { "0": 14 } }],
      }),
    ).toEqual([]);
  });

  it("uses the local offset when bucketing by calendarDate", () => {
    const startUtc = Date.UTC(2019, 8, 12, 3, 0, 0) / 1000;
    const [row] = normalizeRespiration({
      allDayRespiration: [
        {
          startTimeInSeconds: startUtc,
          startTimeOffsetInSeconds: -7 * 3600,
          timeOffsetEpochToBreaths: { "0": 14 },
        },
      ],
    });
    expect(row.calendarDate).toBe("2019-09-11");
  });

  it("uses the UTC date when no local offset is provided", () => {
    const startUtc = Date.UTC(2019, 8, 12, 3, 0, 0) / 1000;
    const [row] = normalizeRespiration({
      allDayRespiration: [
        {
          startTimeInSeconds: startUtc,
          startTimeOffsetInSeconds: 0,
          timeOffsetEpochToBreaths: { "0": 14 },
        },
      ],
    });
    expect(row.calendarDate).toBe("2019-09-12");
  });

  it("drops entries with no map values to average", () => {
    const rows = normalizeRespiration({
      allDayRespiration: [
        {
          startTimeInSeconds: 1_700_000_000,
          startTimeOffsetInSeconds: 0,
          timeOffsetEpochToBreaths: {},
        },
      ],
    });
    expect(rows).toEqual([]);
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
