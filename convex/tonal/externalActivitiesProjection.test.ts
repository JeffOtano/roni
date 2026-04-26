import { describe, expect, it } from "vitest";
import {
  projectExternalActivities,
  projectExternalActivitiesStrict,
} from "./externalActivitiesProjection";
import { estimateCacheValueBytes } from "./proxyCacheLimits";

const VALID_RAW = {
  id: "ext-1",
  userId: "u-1",
  workoutType: "running",
  beginTime: "2026-04-17T10:00:00Z",
  endTime: "2026-04-17T10:30:00Z",
  timezone: "America/Los_Angeles",
  activeDuration: 1500,
  totalDuration: 1800,
  distance: 5000,
  activeCalories: 300,
  totalCalories: 350,
  averageHeartRate: 145,
  source: "Apple Watch",
  externalId: "ext-src-1",
  deviceId: "dev-1",
};

describe("projectExternalActivities", () => {
  it("returns an empty array for non-array payloads", () => {
    expect(projectExternalActivities(null)).toEqual([]);
    expect(projectExternalActivities({ data: [] })).toEqual([]);
  });

  it("strips fields that no reader consumes", () => {
    const result = projectExternalActivities([VALID_RAW]) as Record<string, unknown>[];

    expect(result[0]).not.toHaveProperty("id");
    expect(result[0]).not.toHaveProperty("userId");
    expect(result[0]).not.toHaveProperty("endTime");
    expect(result[0]).not.toHaveProperty("timezone");
    expect(result[0]).not.toHaveProperty("activeDuration");
    expect(result[0]).not.toHaveProperty("deviceId");
  });

  it("retains every field readers consume", () => {
    const result = projectExternalActivities([VALID_RAW]);

    expect(result[0]).toMatchObject({
      workoutType: VALID_RAW.workoutType,
      beginTime: VALID_RAW.beginTime,
      totalDuration: VALID_RAW.totalDuration,
      distance: VALID_RAW.distance,
      activeCalories: VALID_RAW.activeCalories,
      totalCalories: VALID_RAW.totalCalories,
      averageHeartRate: VALID_RAW.averageHeartRate,
      source: "appleHealth",
      externalId: VALID_RAW.externalId,
    });
  });

  it("normalizes source labels before persistence", () => {
    expect(projectExternalActivities([{ ...VALID_RAW, source: "Apple Watch" }])[0].source).toBe(
      "appleHealth",
    );
    expect(projectExternalActivities([{ ...VALID_RAW, source: "Garmin" }])[0].source).toBe(
      "garmin",
    );
    expect(projectExternalActivities([{ ...VALID_RAW, source: "Strava" }])[0].source).toBe("other");
  });

  it("rejects payloads missing required fields", () => {
    const malformed = [{ ...VALID_RAW, beginTime: undefined }];
    expect(projectExternalActivities(malformed)).toEqual([]);
  });

  it("produces a smaller cache footprint than the raw response", () => {
    const raw = Array.from({ length: 50 }, (_, i) => ({
      ...VALID_RAW,
      id: `ext-${i}`,
      externalId: `ext-src-${i}`,
    }));

    const projected = projectExternalActivities(raw);

    expect(estimateCacheValueBytes(projected)).toBeLessThan(estimateCacheValueBytes(raw));
  });
});

describe("projectExternalActivitiesStrict", () => {
  it("projects valid input the same as the lenient variant", () => {
    const result = projectExternalActivitiesStrict([VALID_RAW]);
    expect(result).toHaveLength(1);
  });

  it("throws on non-array input so cachedFetch falls back to stale data", () => {
    expect(() => projectExternalActivitiesStrict(null)).toThrow(/expected array/);
    expect(() => projectExternalActivitiesStrict({ data: [] })).toThrow(/expected array/);
  });

  it("throws on schema mismatch instead of returning an empty array", () => {
    const malformed = [{ ...VALID_RAW, beginTime: undefined }];
    expect(() => projectExternalActivitiesStrict(malformed)).toThrow();
  });

  it("rejects the whole array when one entry is malformed", () => {
    const mixed = [VALID_RAW, { ...VALID_RAW, beginTime: undefined }, VALID_RAW];
    expect(() => projectExternalActivitiesStrict(mixed)).toThrow();
  });
});
