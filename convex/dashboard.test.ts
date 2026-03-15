import { describe, expect, it } from "vitest";
import { isTonalWorkout } from "./dashboard";
import type { Activity } from "./tonal/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeActivity(workoutId: string, totalVolume: number, targetArea = "Full Body"): Activity {
  return {
    activityId: "act-1",
    userId: "user-1",
    activityTime: "2026-03-14T10:00:00Z",
    activityType: "workout",
    workoutPreview: {
      activityId: "act-1",
      workoutId,
      workoutTitle: "Test",
      programName: "",
      coachName: "",
      level: "beginner",
      targetArea,
      isGuidedWorkout: false,
      workoutType: "strength",
      beginTime: "2026-03-14T10:00:00Z",
      totalDuration: 2700,
      totalVolume,
      totalWork: 0,
      totalAchievements: 0,
      activityType: "workout",
    },
  };
}

// ---------------------------------------------------------------------------
// isTonalWorkout
// ---------------------------------------------------------------------------

describe("isTonalWorkout", () => {
  it("returns true when totalVolume is greater than zero", () => {
    const activity = makeActivity("", 1);

    expect(isTonalWorkout(activity)).toBe(true);
  });

  it("returns true when workoutId is a non-empty string", () => {
    const activity = makeActivity("workout-abc", 0);

    expect(isTonalWorkout(activity)).toBe(true);
  });

  it("returns true when both totalVolume > 0 and workoutId is non-empty", () => {
    const activity = makeActivity("workout-abc", 5000);

    expect(isTonalWorkout(activity)).toBe(true);
  });

  it("returns false when totalVolume is zero and workoutId is empty string", () => {
    const activity = makeActivity("", 0);

    expect(isTonalWorkout(activity)).toBe(false);
  });

  it("returns false when totalVolume is zero and workoutId is empty string (edge: negative volume)", () => {
    // Negative volume shouldn't occur in practice but verify the guard
    const activity = makeActivity("", -1);

    // -1 > 0 is false; workoutId is "" so empty string check also false
    expect(isTonalWorkout(activity)).toBe(false);
  });

  it("returns true when totalVolume is a large positive number", () => {
    const activity = makeActivity("", 999999);

    expect(isTonalWorkout(activity)).toBe(true);
  });

  it("returns false when totalVolume is exactly zero and workoutId is empty (boundary)", () => {
    const activity = makeActivity("", 0);

    // 0 > 0 is false; "" !== "" is false → false
    expect(isTonalWorkout(activity)).toBe(false);
  });
});
