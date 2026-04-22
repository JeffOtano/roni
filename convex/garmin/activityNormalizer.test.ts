import { describe, expect, it } from "vitest";
import { extractFirstUserIdFromSummary, normalizeGarminActivities } from "./activityNormalizer";

// Fixture mirrors the Activity API V1.2.4 §5.1 Push Notification example
// almost exactly. Only the userId/userAccessToken pair is adjusted so
// we're not checking an example value in to source.
const samplePush = {
  activities: [
    {
      userId: "b44e1be6-8287-4704-8ab2-a0e191bfffbc",
      userAccessToken: "token-abc",
      summaryId: "EXAMPLE_12345",
      activityId: 5001968355,
      activityType: "RUNNING",
      activityName: "Olathe RUNNING",
      startTimeInSeconds: 1452470400,
      startTimeOffsetInSeconds: 0,
      durationInSeconds: 11580,
      averageHeartRateInBeatsPerMinute: 144,
      maxHeartRateInBeatsPerMinute: 159,
      averageSpeedInMetersPerSecond: 2.88899993896,
      averagePaceInMinutesPerKilometer: 5.77,
      distanceInMeters: 519818.125,
      activeKilocalories: 448,
      totalElevationGainInMeters: 16.0,
      deviceName: "Garmin fenix 8",
    },
  ],
};

describe("normalizeGarminActivities", () => {
  it("maps the fields documented in Activity API §7.1", () => {
    const [row] = normalizeGarminActivities(samplePush);
    expect(row.externalId).toBe("EXAMPLE_12345");
    expect(row.workoutType).toBe("RUNNING");
    expect(row.totalDuration).toBe(11580);
    expect(row.beginTime).toBe("2016-01-11T00:00:00.000Z");
    expect(row.source).toBe("garmin");
    expect(row.activeCalories).toBe(448);
    expect(row.averageHeartRate).toBe(144);
    expect(row.maxHeartRate).toBe(159);
    expect(row.distance).toBe(519818.125);
    expect(row.elevationGainMeters).toBe(16);
  });

  it("converts averagePaceInMinutesPerKilometer into seconds per km", () => {
    const [row] = normalizeGarminActivities(samplePush);
    expect(row.avgPaceSecondsPerKm).toBeCloseTo(5.77 * 60, 5);
  });

  it("skips entries missing a required field instead of writing garbage", () => {
    const payload = {
      activities: [
        { ...samplePush.activities[0] },
        { userId: "u", summaryId: "only-summary-id" },
        { summaryId: "no-type", startTimeInSeconds: 1, durationInSeconds: 10 },
      ],
    };
    const rows = normalizeGarminActivities(payload);
    expect(rows).toHaveLength(1);
    expect(rows[0].externalId).toBe("EXAMPLE_12345");
  });

  it("returns [] when the envelope isn't an activities payload", () => {
    expect(normalizeGarminActivities(null)).toEqual([]);
    expect(normalizeGarminActivities({})).toEqual([]);
    expect(normalizeGarminActivities({ activities: "nope" })).toEqual([]);
    expect(normalizeGarminActivities({ dailies: [] })).toEqual([]);
  });

  it("leaves optional fields undefined when the payload omits them", () => {
    const minimal = {
      activities: [
        {
          userId: "u",
          summaryId: "s1",
          activityType: "STRENGTH_TRAINING",
          startTimeInSeconds: 1_700_000_000,
          durationInSeconds: 3600,
        },
      ],
    };
    const [row] = normalizeGarminActivities(minimal);
    expect(row.averageHeartRate).toBeUndefined();
    expect(row.distance).toBeUndefined();
    expect(row.avgPaceSecondsPerKm).toBeUndefined();
    expect(row.elevationGainMeters).toBeUndefined();
  });
});

describe("extractFirstUserIdFromSummary", () => {
  it("reads userId from the first entry of the matching envelope key", () => {
    expect(extractFirstUserIdFromSummary("activities", samplePush)).toBe(
      "b44e1be6-8287-4704-8ab2-a0e191bfffbc",
    );
  });

  it("returns null when the envelope key is missing or empty", () => {
    expect(extractFirstUserIdFromSummary("activities", null)).toBeNull();
    expect(extractFirstUserIdFromSummary("activities", {})).toBeNull();
    expect(extractFirstUserIdFromSummary("activities", { activities: [] })).toBeNull();
    expect(
      extractFirstUserIdFromSummary("activities", { activities: [{ userId: 42 }] }),
    ).toBeNull();
  });
});
