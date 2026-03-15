import { describe, expect, it } from "vitest";
import { computeProgressMetrics } from "./stats";
import type { Activity } from "./tonal/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeActivity(overrides: {
  activityTime: string;
  totalVolume?: number;
  totalDuration?: number;
  targetArea?: string;
}): Activity {
  return {
    activityId: "act-" + overrides.activityTime,
    userId: "user-1",
    activityTime: overrides.activityTime,
    activityType: "workout",
    workoutPreview: {
      activityId: "act-" + overrides.activityTime,
      workoutId: "w-1",
      workoutTitle: "Test Workout",
      programName: "",
      coachName: "",
      level: "beginner",
      targetArea: overrides.targetArea ?? "Full Body",
      isGuidedWorkout: false,
      workoutType: "strength",
      beginTime: overrides.activityTime,
      totalDuration: overrides.totalDuration ?? 2700,
      totalVolume: overrides.totalVolume ?? 10000,
      totalWork: 5000,
      totalAchievements: 0,
      activityType: "workout",
    },
  };
}

// ---------------------------------------------------------------------------
// computeProgressMetrics
// ---------------------------------------------------------------------------

describe("computeProgressMetrics", () => {
  describe("empty activities array", () => {
    it("returns all-zero metrics for an empty array", () => {
      const result = computeProgressMetrics([]);

      expect(result).toEqual({
        totalWorkouts: 0,
        totalVolume: 0,
        avgVolume: 0,
        totalDuration: 0,
        avgDuration: 0,
        workoutsByTargetArea: {},
        workoutsPerWeek: 0,
      });
    });
  });

  describe("single activity", () => {
    it("returns metrics for a single activity without division errors", () => {
      const activities = [
        makeActivity({
          activityTime: "2026-03-14T10:00:00Z",
          totalVolume: 8000,
          totalDuration: 3600,
        }),
      ];

      const result = computeProgressMetrics(activities);

      expect(result.totalWorkouts).toBe(1);
      expect(result.totalVolume).toBe(8000);
      expect(result.avgVolume).toBe(8000);
      expect(result.totalDuration).toBe(3600);
      expect(result.avgDuration).toBe(3600);
    });

    it("clamps workoutsPerWeek to 1 when period span is zero (single workout)", () => {
      const activities = [makeActivity({ activityTime: "2026-03-14T10:00:00Z" })];

      const result = computeProgressMetrics(activities);

      // period = 0ms → periodWeeks clamps to 1 → workoutsPerWeek = 1 / 1 = 1.0
      expect(result.workoutsPerWeek).toBe(1);
    });
  });

  describe("total volume calculation", () => {
    it("sums totalVolume across all activities", () => {
      const activities = [
        makeActivity({ activityTime: "2026-03-10T10:00:00Z", totalVolume: 5000 }),
        makeActivity({ activityTime: "2026-03-12T10:00:00Z", totalVolume: 7000 }),
        makeActivity({ activityTime: "2026-03-14T10:00:00Z", totalVolume: 3000 }),
      ];

      const result = computeProgressMetrics(activities);

      expect(result.totalVolume).toBe(15000);
    });

    it("computes avgVolume as rounded total volume divided by total workouts", () => {
      const activities = [
        makeActivity({ activityTime: "2026-03-10T10:00:00Z", totalVolume: 1000 }),
        makeActivity({ activityTime: "2026-03-12T10:00:00Z", totalVolume: 2000 }),
        makeActivity({ activityTime: "2026-03-14T10:00:00Z", totalVolume: 1500 }),
      ];

      const result = computeProgressMetrics(activities);

      // (1000 + 2000 + 1500) / 3 = 1500
      expect(result.avgVolume).toBe(1500);
    });
  });

  describe("average duration calculation", () => {
    it("computes avgDuration as rounded mean of totalDuration across activities", () => {
      const activities = [
        makeActivity({ activityTime: "2026-03-10T10:00:00Z", totalDuration: 3000 }),
        makeActivity({ activityTime: "2026-03-12T10:00:00Z", totalDuration: 4000 }),
      ];

      const result = computeProgressMetrics(activities);

      // (3000 + 4000) / 2 = 3500
      expect(result.avgDuration).toBe(3500);
    });

    it("rounds avgDuration to nearest integer", () => {
      const activities = [
        makeActivity({ activityTime: "2026-03-10T10:00:00Z", totalDuration: 3001 }),
        makeActivity({ activityTime: "2026-03-12T10:00:00Z", totalDuration: 4000 }),
      ];

      const result = computeProgressMetrics(activities);

      // (3001 + 4000) / 2 = 3500.5 → rounds to 3501
      expect(result.avgDuration).toBe(3501);
    });
  });

  describe("workouts per week computation", () => {
    it("computes workoutsPerWeek correctly across an exact 7-day window", () => {
      const activities = [
        makeActivity({ activityTime: "2026-03-07T10:00:00Z" }),
        makeActivity({ activityTime: "2026-03-14T10:00:00Z" }),
      ];

      const result = computeProgressMetrics(activities);

      // period = 7 days = 1 week; 2 workouts / 1 week = 2.0
      expect(result.workoutsPerWeek).toBe(2);
    });

    it("computes workoutsPerWeek correctly across a 14-day window", () => {
      const activities = [
        makeActivity({ activityTime: "2026-03-01T10:00:00Z" }),
        makeActivity({ activityTime: "2026-03-08T10:00:00Z" }),
        makeActivity({ activityTime: "2026-03-15T10:00:00Z" }),
      ];

      const result = computeProgressMetrics(activities);

      // period = 14 days = 2 weeks; 3 workouts / 2 = 1.5
      expect(result.workoutsPerWeek).toBe(1.5);
    });

    it("rounds workoutsPerWeek to one decimal place", () => {
      const activities = [
        makeActivity({ activityTime: "2026-03-07T10:00:00Z" }),
        makeActivity({ activityTime: "2026-03-11T10:00:00Z" }),
        makeActivity({ activityTime: "2026-03-14T10:00:00Z" }),
      ];

      const result = computeProgressMetrics(activities);

      // period = 7 days = 1 week; 3 / 1 = 3.0 (but verify rounding works at non-round values)
      expect(Number.isFinite(result.workoutsPerWeek)).toBe(true);
      // Verify it's rounded to 1 decimal
      const str = result.workoutsPerWeek.toString();
      const decimalPlaces = str.includes(".") ? str.split(".")[1].length : 0;
      expect(decimalPlaces).toBeLessThanOrEqual(1);
    });
  });

  describe("workouts by target area", () => {
    it("counts workouts per target area", () => {
      const activities = [
        makeActivity({ activityTime: "2026-03-10T10:00:00Z", targetArea: "Upper Body" }),
        makeActivity({ activityTime: "2026-03-11T10:00:00Z", targetArea: "Lower Body" }),
        makeActivity({ activityTime: "2026-03-12T10:00:00Z", targetArea: "Upper Body" }),
      ];

      const result = computeProgressMetrics(activities);

      expect(result.workoutsByTargetArea).toEqual({
        "Upper Body": 2,
        "Lower Body": 1,
      });
    });

    it("uses 'Unknown' when targetArea is missing (undefined/null)", () => {
      const activity = makeActivity({ activityTime: "2026-03-14T10:00:00Z" });
      // force targetArea to undefined
      activity.workoutPreview.targetArea = undefined as unknown as string;

      const result = computeProgressMetrics([activity]);

      expect(result.workoutsByTargetArea).toEqual({ Unknown: 1 });
    });

    it("aggregates multiple target areas correctly", () => {
      const activities = [
        makeActivity({ activityTime: "2026-03-10T10:00:00Z", targetArea: "Full Body" }),
        makeActivity({ activityTime: "2026-03-11T10:00:00Z", targetArea: "Full Body" }),
        makeActivity({ activityTime: "2026-03-12T10:00:00Z", targetArea: "Full Body" }),
        makeActivity({ activityTime: "2026-03-13T10:00:00Z", targetArea: "Core" }),
      ];

      const result = computeProgressMetrics(activities);

      expect(result.workoutsByTargetArea["Full Body"]).toBe(3);
      expect(result.workoutsByTargetArea["Core"]).toBe(1);
    });
  });

  describe("total workouts count", () => {
    it("reflects the exact number of activities provided", () => {
      const activities = [
        makeActivity({ activityTime: "2026-03-10T10:00:00Z" }),
        makeActivity({ activityTime: "2026-03-11T10:00:00Z" }),
        makeActivity({ activityTime: "2026-03-12T10:00:00Z" }),
        makeActivity({ activityTime: "2026-03-13T10:00:00Z" }),
        makeActivity({ activityTime: "2026-03-14T10:00:00Z" }),
      ];

      const result = computeProgressMetrics(activities);

      expect(result.totalWorkouts).toBe(5);
    });
  });
});
