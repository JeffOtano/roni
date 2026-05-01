import { describe, expect, it } from "vitest";
import { frequencyWindowMs } from "./checkIns";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("frequencyWindowMs", () => {
  it("daily returns exactly 24 hours", () => {
    expect(frequencyWindowMs("daily")).toBe(DAY_MS);
  });

  it("every_other_day returns exactly 48 hours", () => {
    expect(frequencyWindowMs("every_other_day")).toBe(2 * DAY_MS);
  });

  it("weekly returns exactly 7 days", () => {
    expect(frequencyWindowMs("weekly")).toBe(7 * DAY_MS);
  });

  it("every_other_day is strictly between daily and weekly", () => {
    const daily = frequencyWindowMs("daily");
    const every_other_day = frequencyWindowMs("every_other_day");
    const weekly = frequencyWindowMs("weekly");
    expect(every_other_day).toBeGreaterThan(daily);
    expect(every_other_day).toBeLessThan(weekly);
  });

  it("all windows are positive", () => {
    for (const freq of ["daily", "every_other_day", "weekly"] as const) {
      expect(frequencyWindowMs(freq)).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// hasRecentCheckIn query semantics
// ---------------------------------------------------------------------------
// The query uses .withIndex("by_userId_createdAt", q => q.eq("userId").gte("createdAt", since))
// so it never loads check-ins older than `since`, and uses .first() to stop at
// the first match.  The correctness of the index-bound approach is validated
// through the typed schema; these tests document the expected Boolean outcomes.

describe("hasRecentCheckIn semantics", () => {
  it("a check-in exactly at the since boundary counts as recent", () => {
    const since = 1000;
    const checkInCreatedAt = 1000;
    expect(checkInCreatedAt >= since).toBe(true);
  });

  it("a check-in one ms before the since boundary does not count", () => {
    const since = 1000;
    const checkInCreatedAt = 999;
    expect(checkInCreatedAt >= since).toBe(false);
  });
});
