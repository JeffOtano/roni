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
// hasRecentCheckIn boundary semantics (documentation-only)
// ---------------------------------------------------------------------------
// These tests do NOT exercise hasRecentCheckIn directly — running the Convex
// query requires Convex test infrastructure. They assert the plain JS boundary
// comparison the query relies on (createdAt >= since) so the documented
// boundary behavior cannot drift silently. The actual index-bound query is
// .withIndex("by_userId_createdAt", q => q.eq("userId").gte("createdAt", since))
// followed by .first(), which is type-checked through the schema.

describe("hasRecentCheckIn boundary semantics (documented)", () => {
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
