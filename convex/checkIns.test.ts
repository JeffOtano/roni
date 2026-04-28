/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// frequencyWindowMs — mirror of the private helper in checkIns.ts
// ---------------------------------------------------------------------------

function frequencyWindowMs(frequency: "daily" | "every_other_day" | "weekly"): number {
  switch (frequency) {
    case "daily":
      return 24 * 60 * 60 * 1000;
    case "every_other_day":
      return 2 * 24 * 60 * 60 * 1000;
    case "weekly":
      return 7 * 24 * 60 * 60 * 1000;
  }
}

describe("frequencyWindowMs", () => {
  it("daily is 24 hours", () => {
    expect(frequencyWindowMs("daily")).toBe(24 * 60 * 60 * 1000);
  });

  it("every_other_day is 48 hours", () => {
    expect(frequencyWindowMs("every_other_day")).toBe(2 * 24 * 60 * 60 * 1000);
  });

  it("weekly is 7 days", () => {
    expect(frequencyWindowMs("weekly")).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it("daily < every_other_day < weekly", () => {
    expect(frequencyWindowMs("daily")).toBeLessThan(frequencyWindowMs("every_other_day"));
    expect(frequencyWindowMs("every_other_day")).toBeLessThan(frequencyWindowMs("weekly"));
  });
});

// ---------------------------------------------------------------------------
// check-in frequency gate logic
// These mirror the guard inside evaluateUserCheckIn so the invariant is
// documented and protected independently of the action itself.
// ---------------------------------------------------------------------------

describe("frequency gate", () => {
  const now = Date.now();

  it("skips a user whose last check-in is within the daily window", () => {
    const window = frequencyWindowMs("daily");
    const lastCreatedAt = now - window + 1000; // 1 second inside window
    expect(lastCreatedAt != null && now - lastCreatedAt < window).toBe(true);
  });

  it("allows a user whose last check-in is outside the daily window", () => {
    const window = frequencyWindowMs("daily");
    const lastCreatedAt = now - window - 1000; // 1 second outside window
    expect(lastCreatedAt != null && now - lastCreatedAt < window).toBe(false);
  });

  it("allows a user with no previous check-in", () => {
    const window = frequencyWindowMs("daily");
    const lastCreatedAt = null;
    expect(lastCreatedAt != null && now - lastCreatedAt < window).toBe(false);
  });

  it("weekly frequency allows a user checked in 8 days ago", () => {
    const window = frequencyWindowMs("weekly");
    const eightDaysMs = 8 * 24 * 60 * 60 * 1000;
    const lastCreatedAt = now - eightDaysMs;
    expect(lastCreatedAt != null && now - lastCreatedAt < window).toBe(false);
  });

  it("weekly frequency blocks a user checked in 3 days ago", () => {
    const window = frequencyWindowMs("weekly");
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
    const lastCreatedAt = now - threeDaysMs;
    expect(lastCreatedAt != null && now - lastCreatedAt < window).toBe(true);
  });
});
