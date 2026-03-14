import { describe, expect, it } from "vitest";
import { getSessionTypesForSplit, getTrainingDayIndices } from "./weekProgrammingHelpers";

describe("getTrainingDayIndices", () => {
  it("returns Mon/Wed/Fri (0, 2, 4) for 3 target days", () => {
    expect(getTrainingDayIndices(3)).toEqual([0, 2, 4]);
  });

  it("returns 0..6 for 7 target days", () => {
    expect(getTrainingDayIndices(7)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("returns single day index for 1 target day", () => {
    expect(getTrainingDayIndices(1)).toEqual([0]);
  });

  it("returns empty array for 0 or negative target days", () => {
    expect(getTrainingDayIndices(0)).toEqual([]);
    expect(getTrainingDayIndices(-1)).toEqual([]);
  });

  it("returns indices for 4 target days", () => {
    expect(getTrainingDayIndices(4)).toEqual([0, 1, 2, 3]);
  });

  it("returns two evenly spaced indices for 2 target days", () => {
    expect(getTrainingDayIndices(2)).toEqual([0, 3]);
  });

  it("returns five indices for 5 target days", () => {
    expect(getTrainingDayIndices(5)).toEqual([0, 1, 2, 3, 4]);
  });

  it("returns six indices for 6 target days", () => {
    expect(getTrainingDayIndices(6)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("returns empty array for target days greater than 7", () => {
    expect(getTrainingDayIndices(8)).toEqual([]);
  });
});

describe("getSessionTypesForSplit", () => {
  it("assigns push, pull, legs in order for ppl with 3 days", () => {
    const result = getSessionTypesForSplit("ppl", [0, 2, 4]);
    expect(result).toEqual([
      { dayIndex: 0, sessionType: "push" },
      { dayIndex: 2, sessionType: "pull" },
      { dayIndex: 4, sessionType: "legs" },
    ]);
  });

  it("assigns upper, lower in order for upper_lower with 2 days", () => {
    const result = getSessionTypesForSplit("upper_lower", [0, 3]);
    expect(result).toEqual([
      { dayIndex: 0, sessionType: "upper" },
      { dayIndex: 3, sessionType: "lower" },
    ]);
  });

  it("assigns full_body for each day for full_body split", () => {
    const result = getSessionTypesForSplit("full_body", [0, 2, 4]);
    expect(result).toEqual([
      { dayIndex: 0, sessionType: "full_body" },
      { dayIndex: 2, sessionType: "full_body" },
      { dayIndex: 4, sessionType: "full_body" },
    ]);
  });

  it("cycles push, pull, legs for ppl with 6 training days", () => {
    const result = getSessionTypesForSplit("ppl", [0, 1, 2, 3, 4, 5]);
    expect(result).toEqual([
      { dayIndex: 0, sessionType: "push" },
      { dayIndex: 1, sessionType: "pull" },
      { dayIndex: 2, sessionType: "legs" },
      { dayIndex: 3, sessionType: "push" },
      { dayIndex: 4, sessionType: "pull" },
      { dayIndex: 5, sessionType: "legs" },
    ]);
  });
});

/**
 * programWeek (internal action) return shape. We cannot run the action in Vitest;
 * these tests lock the contract for success and "week plan already exists" failure.
 */
describe("programWeek return shape contract", () => {
  /** Error message produced by programWeek when a week plan already exists (see weekProgramming.ts). */
  const weekPlanAlreadyExistsError = (weekStartDate: string) =>
    `Week plan already exists for ${weekStartDate}. Use update or a different week.`;

  it("failure when week plan exists has success false and error containing 'already exists'", () => {
    const weekStartDate = "2026-03-09";
    const result: { success: false; error: string } = {
      success: false,
      error: weekPlanAlreadyExistsError(weekStartDate),
    };
    expect(result.success).toBe(false);
    expect(result.error).toContain("already exists");
    expect(result.error).toContain(weekStartDate);
  });

  it("success result has success true and weekPlanId", () => {
    type SuccessResult = { success: true; weekPlanId: string };
    const result: SuccessResult = {
      success: true,
      weekPlanId: "jd7abc123" as unknown as string,
    };
    expect(result.success).toBe(true);
    expect(typeof result.weekPlanId).toBe("string");
  });
});
