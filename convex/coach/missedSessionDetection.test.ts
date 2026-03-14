import { describe, expect, it } from "vitest";
import {
  type DaySlot,
  detectMissedSessions,
  formatMissedSessionContext,
  type MissedSessionSummary,
} from "./missedSessionDetection";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeDays(configs: Array<{ type: string; planId?: string }>): DaySlot[] {
  const result: DaySlot[] = [];
  for (let i = 0; i < 7; i++) {
    const config = configs[i] ?? { type: "rest" };
    result.push({
      sessionType: config.type as DaySlot["sessionType"],
      status: "programmed",
      workoutPlanId: config.planId,
    });
  }
  return result;
}

function emptySummary(overrides: Partial<MissedSessionSummary> = {}): MissedSessionSummary {
  return {
    missedSessions: [],
    nonProgrammedWorkouts: [],
    pastTrainingDays: 0,
    completedDays: 0,
    daysSinceLastWorkout: -1,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// detectMissedSessions
// ---------------------------------------------------------------------------

describe("detectMissedSessions", () => {
  it("detects a single missed session when Monday push is not completed", () => {
    const days = makeDays([
      { type: "push", planId: "plan-mon" },
      { type: "rest" },
      { type: "pull", planId: "plan-wed" },
    ]);

    const result = detectMissedSessions({
      days,
      todayDayIndex: 2, // Wednesday
      completedTonalIds: new Set<string>(),
      tonalWorkoutIdByPlanId: new Map([
        ["plan-mon", "tonal-push"],
        ["plan-wed", "tonal-pull"],
      ]),
      activityDates: [],
    });

    expect(result.missedSessions).toHaveLength(1);
    expect(result.missedSessions[0]).toEqual({
      dayIndex: 0,
      dayName: "Monday",
      sessionType: "Push",
    });
    expect(result.pastTrainingDays).toBe(1);
    expect(result.completedDays).toBe(0);
  });

  it("returns no misses when all past sessions are completed", () => {
    const days = makeDays([
      { type: "push", planId: "plan-mon" },
      { type: "pull", planId: "plan-tue" },
      { type: "legs", planId: "plan-wed" },
    ]);

    const result = detectMissedSessions({
      days,
      todayDayIndex: 3, // Thursday
      completedTonalIds: new Set(["tonal-push", "tonal-pull", "tonal-legs"]),
      tonalWorkoutIdByPlanId: new Map([
        ["plan-mon", "tonal-push"],
        ["plan-tue", "tonal-pull"],
        ["plan-wed", "tonal-legs"],
      ]),
      activityDates: [],
    });

    expect(result.missedSessions).toHaveLength(0);
    expect(result.pastTrainingDays).toBe(3);
    expect(result.completedDays).toBe(3);
  });

  it("does not count today's session as missed", () => {
    const days = makeDays([
      { type: "push", planId: "plan-mon" },
      { type: "pull", planId: "plan-tue" },
    ]);

    const result = detectMissedSessions({
      days,
      todayDayIndex: 1, // Tuesday — today's pull session shouldn't be missed
      completedTonalIds: new Set(["tonal-push"]),
      tonalWorkoutIdByPlanId: new Map([
        ["plan-mon", "tonal-push"],
        ["plan-tue", "tonal-pull"],
      ]),
      activityDates: [],
    });

    expect(result.missedSessions).toHaveLength(0);
    expect(result.pastTrainingDays).toBe(1);
    expect(result.completedDays).toBe(1);
  });

  it("does not count future sessions as missed", () => {
    const days = makeDays([
      { type: "push", planId: "plan-mon" },
      { type: "rest" },
      { type: "rest" },
      { type: "rest" },
      { type: "legs", planId: "plan-fri" },
      { type: "upper", planId: "plan-sat" },
    ]);

    const result = detectMissedSessions({
      days,
      todayDayIndex: 1, // Tuesday
      completedTonalIds: new Set(["tonal-push"]),
      tonalWorkoutIdByPlanId: new Map([
        ["plan-mon", "tonal-push"],
        ["plan-fri", "tonal-legs"],
        ["plan-sat", "tonal-upper"],
      ]),
      activityDates: [],
    });

    expect(result.missedSessions).toHaveLength(0);
    expect(result.pastTrainingDays).toBe(1);
  });

  it("detects multiple missed sessions", () => {
    const days = makeDays([
      { type: "push", planId: "plan-mon" },
      { type: "pull", planId: "plan-tue" },
      { type: "rest" },
      { type: "legs", planId: "plan-thu" },
    ]);

    const result = detectMissedSessions({
      days,
      todayDayIndex: 4, // Friday
      completedTonalIds: new Set<string>(),
      tonalWorkoutIdByPlanId: new Map([
        ["plan-mon", "tonal-push"],
        ["plan-tue", "tonal-pull"],
        ["plan-thu", "tonal-legs"],
      ]),
      activityDates: [],
    });

    expect(result.missedSessions).toHaveLength(3);
    expect(result.missedSessions[0].dayName).toBe("Monday");
    expect(result.missedSessions[1].dayName).toBe("Tuesday");
    expect(result.missedSessions[2].dayName).toBe("Thursday");
    expect(result.pastTrainingDays).toBe(3);
    expect(result.completedDays).toBe(0);
  });

  it("does not count rest days as missed", () => {
    const days = makeDays([
      { type: "rest" },
      { type: "rest" },
      { type: "push", planId: "plan-wed" },
    ]);

    const result = detectMissedSessions({
      days,
      todayDayIndex: 3, // Thursday
      completedTonalIds: new Set(["tonal-push"]),
      tonalWorkoutIdByPlanId: new Map([["plan-wed", "tonal-push"]]),
      activityDates: [],
    });

    expect(result.missedSessions).toHaveLength(0);
    expect(result.pastTrainingDays).toBe(1);
  });

  it("counts all sessions as missed for extended absence", () => {
    const days = makeDays([
      { type: "push", planId: "plan-mon" },
      { type: "pull", planId: "plan-tue" },
      { type: "rest" },
      { type: "legs", planId: "plan-thu" },
      { type: "upper", planId: "plan-fri" },
      { type: "rest" },
    ]);

    const result = detectMissedSessions({
      days,
      todayDayIndex: 6, // Sunday
      completedTonalIds: new Set<string>(),
      tonalWorkoutIdByPlanId: new Map([
        ["plan-mon", "tonal-push"],
        ["plan-tue", "tonal-pull"],
        ["plan-thu", "tonal-legs"],
        ["plan-fri", "tonal-upper"],
      ]),
      activityDates: [],
    });

    expect(result.missedSessions).toHaveLength(4);
    expect(result.pastTrainingDays).toBe(4);
    expect(result.completedDays).toBe(0);
  });

  it("calculates daysSinceLastWorkout correctly from activity dates", () => {
    const days = makeDays([{ type: "push", planId: "plan-mon" }]);

    const result = detectMissedSessions({
      days,
      todayDayIndex: 4, // Friday
      completedTonalIds: new Set(["tonal-push"]),
      tonalWorkoutIdByPlanId: new Map([["plan-mon", "tonal-push"]]),
      activityDates: ["2026-03-09", "2026-03-11"],
      todayDate: "2026-03-14",
    });

    // Most recent activity: March 11, today: March 14 -> 3 days
    expect(result.daysSinceLastWorkout).toBe(3);
  });

  it("returns daysSinceLastWorkout 0 when trained today", () => {
    const days = makeDays([{ type: "push", planId: "plan-mon" }]);

    const result = detectMissedSessions({
      days,
      todayDayIndex: 0, // Monday
      completedTonalIds: new Set(["tonal-push"]),
      tonalWorkoutIdByPlanId: new Map([["plan-mon", "tonal-push"]]),
      activityDates: ["2026-03-14"],
      todayDate: "2026-03-14",
    });

    expect(result.daysSinceLastWorkout).toBe(0);
  });

  it("marks sessions without workoutPlanId as missed", () => {
    const days = makeDays([
      { type: "push" }, // no planId
      { type: "pull", planId: "plan-tue" },
    ]);

    const result = detectMissedSessions({
      days,
      todayDayIndex: 2,
      completedTonalIds: new Set(["tonal-pull"]),
      tonalWorkoutIdByPlanId: new Map([["plan-tue", "tonal-pull"]]),
      activityDates: [],
    });

    expect(result.missedSessions).toHaveLength(1);
    expect(result.missedSessions[0].dayIndex).toBe(0);
    expect(result.completedDays).toBe(1);
  });

  it("formats full_body session type with proper casing", () => {
    const days = makeDays([{ type: "full_body", planId: "plan-mon" }]);

    const result = detectMissedSessions({
      days,
      todayDayIndex: 1,
      completedTonalIds: new Set<string>(),
      tonalWorkoutIdByPlanId: new Map([["plan-mon", "tonal-fb"]]),
      activityDates: [],
    });

    expect(result.missedSessions[0].sessionType).toBe("Full Body");
  });

  it("detects non-programmed workout when activity differs from plan", () => {
    const days = makeDays([{ type: "pull", planId: "plan-mon" }]);

    const activityByTonalId = new Map([
      ["tonal-other", { title: "Full Body Blast", date: "2026-03-09" }],
    ]);

    const result = detectMissedSessions({
      days,
      todayDayIndex: 1,
      completedTonalIds: new Set(["tonal-other"]),
      tonalWorkoutIdByPlanId: new Map([["plan-mon", "tonal-pull"]]),
      activityDates: ["2026-03-09"],
      activityByTonalId,
    });

    expect(result.nonProgrammedWorkouts).toHaveLength(1);
    expect(result.nonProgrammedWorkouts[0]).toEqual({
      dayIndex: 0,
      dayName: "Monday",
      programmedSessionType: "Pull",
      actualWorkoutTitle: "Full Body Blast",
    });
    expect(result.completedDays).toBe(1);
    expect(result.missedSessions).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// formatMissedSessionContext
// ---------------------------------------------------------------------------

describe("formatMissedSessionContext", () => {
  it("returns empty string when no missed sessions or issues", () => {
    const result = formatMissedSessionContext(
      emptySummary({ pastTrainingDays: 3, completedDays: 3, daysSinceLastWorkout: 0 }),
    );

    expect(result).toBe("");
  });

  it("formats a single missed session correctly", () => {
    const result = formatMissedSessionContext(
      emptySummary({
        missedSessions: [{ dayIndex: 2, dayName: "Wednesday", sessionType: "Pull" }],
        pastTrainingDays: 2,
        completedDays: 1,
      }),
    );

    expect(result).toBe("Missed: Pull Day (Wednesday). Ready to replan the week.");
  });

  it("formats multiple missed sessions with fresh plan advice", () => {
    const result = formatMissedSessionContext(
      emptySummary({
        missedSessions: [
          { dayIndex: 0, dayName: "Monday", sessionType: "Push" },
          { dayIndex: 2, dayName: "Wednesday", sessionType: "Pull" },
        ],
        pastTrainingDays: 3,
        completedDays: 1,
      }),
    );

    expect(result).toBe(
      "Missed: Push Day (Monday), Pull Day (Wednesday). Consider a fresh week plan.",
    );
  });

  it("includes extended absence message when daysSinceLastWorkout >= 7", () => {
    const result = formatMissedSessionContext(
      emptySummary({
        missedSessions: [{ dayIndex: 0, dayName: "Monday", sessionType: "Push" }],
        daysSinceLastWorkout: 8,
        pastTrainingDays: 1,
      }),
    );

    expect(result).toContain("No workouts in 8 days. Welcome-back ramp-up recommended.");
    expect(result).toContain("Missed:");
  });

  it("mentions non-programmed workout with actual title", () => {
    const result = formatMissedSessionContext(
      emptySummary({
        nonProgrammedWorkouts: [
          {
            dayIndex: 2,
            dayName: "Wednesday",
            programmedSessionType: "Pull",
            actualWorkoutTitle: "Full Body Blast",
          },
        ],
        pastTrainingDays: 2,
        completedDays: 1,
      }),
    );

    expect(result).toBe("Wednesday: did 'Full Body Blast' instead of programmed Pull Day.");
  });
});
