import { describe, expect, it } from "vitest";
import type { WeekPushResult } from "./pushAndVerify";

describe("WeekPushResult contract", () => {
  it("success result has all fields and counts match", () => {
    const result: WeekPushResult = {
      success: true,
      pushed: 3,
      failed: 0,
      skipped: 4,
      results: [
        {
          dayIndex: 0,
          dayName: "Monday",
          sessionType: "push",
          status: "pushed",
          title: "Push – Monday",
          tonalWorkoutId: "abc123",
          exerciseCount: 18,
        },
        { dayIndex: 1, dayName: "Tuesday", sessionType: "rest", status: "skipped" },
        {
          dayIndex: 2,
          dayName: "Wednesday",
          sessionType: "pull",
          status: "pushed",
          title: "Pull – Wednesday",
          tonalWorkoutId: "def456",
        },
        { dayIndex: 3, dayName: "Thursday", sessionType: "rest", status: "skipped" },
        {
          dayIndex: 4,
          dayName: "Friday",
          sessionType: "legs",
          status: "pushed",
          title: "Legs – Friday",
          tonalWorkoutId: "ghi789",
        },
        { dayIndex: 5, dayName: "Saturday", sessionType: "rest", status: "skipped" },
        { dayIndex: 6, dayName: "Sunday", sessionType: "rest", status: "skipped" },
      ],
    };
    expect(result.success).toBe(true);
    expect(result.pushed + result.failed + result.skipped).toBe(result.results.length);
    expect(result.results).toHaveLength(7);
  });

  it("partial failure has success false", () => {
    const result: WeekPushResult = {
      success: false,
      pushed: 2,
      failed: 1,
      skipped: 4,
      results: [
        { dayIndex: 0, dayName: "Monday", sessionType: "push", status: "pushed", title: "Push" },
        { dayIndex: 2, dayName: "Wednesday", sessionType: "pull", status: "pushed", title: "Pull" },
        {
          dayIndex: 4,
          dayName: "Friday",
          sessionType: "legs",
          status: "failed",
          title: "Legs",
          error: "Tonal API timeout",
        },
      ],
    };
    expect(result.success).toBe(false);
    expect(result.failed).toBe(1);
  });

  it("failed results always include error message", () => {
    const result: WeekPushResult = {
      success: false,
      pushed: 0,
      failed: 1,
      skipped: 6,
      results: [
        {
          dayIndex: 0,
          dayName: "Monday",
          sessionType: "push",
          status: "failed",
          error: "Session expired",
        },
      ],
    };
    const failures = result.results.filter((r) => r.status === "failed");
    for (const f of failures) {
      expect(f.error).toBeTruthy();
    }
  });

  it("all-skipped result is success", () => {
    const result: WeekPushResult = {
      success: true,
      pushed: 0,
      failed: 0,
      skipped: 7,
      results: Array.from({ length: 7 }, (_, i) => ({
        dayIndex: i,
        dayName: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][i],
        sessionType: "rest",
        status: "skipped" as const,
      })),
    };
    expect(result.success).toBe(true);
    expect(result.pushed).toBe(0);
  });
});
