import { afterEach, describe, expect, it, vi } from "vitest";
import { aggregateProgressMetrics, aggregateTrainingFrequency } from "./aggregations";

const NOW = new Date("2026-03-13T12:00:00Z").getTime();

const mockActivities = [
  {
    activityId: "a1",
    userId: "u1",
    activityTime: "2026-03-13T10:00:00Z",
    activityType: "workout",
    workoutPreview: {
      activityId: "a1",
      workoutId: "w1",
      workoutTitle: "Upper Body",
      programName: "",
      coachName: "",
      level: "",
      targetArea: "Upper Body",
      isGuidedWorkout: false,
      workoutType: "custom",
      beginTime: "2026-03-13T10:00:00Z",
      totalDuration: 1800,
      totalVolume: 5000,
      totalWork: 0,
      totalAchievements: 0,
      activityType: "workout",
    },
  },
  {
    activityId: "a2",
    userId: "u1",
    activityTime: "2026-03-12T10:00:00Z",
    activityType: "workout",
    workoutPreview: {
      activityId: "a2",
      workoutId: "w2",
      workoutTitle: "Lower Body",
      programName: "",
      coachName: "",
      level: "",
      targetArea: "Lower Body",
      isGuidedWorkout: false,
      workoutType: "custom",
      beginTime: "2026-03-12T10:00:00Z",
      totalDuration: 1200,
      totalVolume: 3000,
      totalWork: 0,
      totalAchievements: 0,
      activityType: "workout",
    },
  },
  {
    activityId: "a3",
    userId: "u1",
    activityTime: "2026-03-11T10:00:00Z",
    activityType: "workout",
    workoutPreview: {
      activityId: "a3",
      workoutId: "w3",
      workoutTitle: "Push Day",
      programName: "",
      coachName: "",
      level: "",
      targetArea: "Upper Body",
      isGuidedWorkout: false,
      workoutType: "custom",
      beginTime: "2026-03-11T10:00:00Z",
      totalDuration: 1500,
      totalVolume: 4000,
      totalWork: 0,
      totalAchievements: 0,
      activityType: "workout",
    },
  },
];

describe("aggregateProgressMetrics", () => {
  it("computes totals and averages", () => {
    const result = aggregateProgressMetrics(mockActivities);
    expect(result.totalWorkouts).toBe(3);
    expect(result.totalVolumeLbs).toBe(12000);
    expect(result.avgVolumeLbs).toBe(4000);
    expect(result.workoutsByTargetArea["Upper Body"]).toBe(2);
    expect(result.workoutsByTargetArea["Lower Body"]).toBe(1);
  });

  it("handles empty array", () => {
    const result = aggregateProgressMetrics([]);
    expect(result.totalWorkouts).toBe(0);
    expect(result.avgVolumeLbs).toBe(0);
    expect(result.totalVolumeLbs).toBe(0);
    expect(result.totalDurationMinutes).toBe(0);
  });
});

describe("aggregateTrainingFrequency", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("groups by target area with session counts and frequency", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    const result = aggregateTrainingFrequency(mockActivities, 30);
    expect(result.periodDays).toBe(30);
    expect(result.totalSessions).toBe(3);
    expect(result.sessionsPerWeek).toBe(0.7);
    expect(result.byTargetArea.length).toBe(2);
    const upper = result.byTargetArea.find(
      (a: { targetArea: string }) => a.targetArea === "Upper Body",
    );
    expect(upper?.sessions).toBe(2);
    expect(upper?.totalVolumeLbs).toBe(9000);
    expect(upper?.lastWorkout).toBe("2026-03-13T10:00:00Z");
    expect(upper?.daysSinceLastWorkout).toBe(0);
  });

  it("filters activities outside date range", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    const result = aggregateTrainingFrequency(mockActivities, 1);
    // Only a1 (2026-03-13) should be within 1 day of NOW (2026-03-13 12:00)
    expect(result.totalSessions).toBe(1);
  });
});
