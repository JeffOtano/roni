import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatRelativeTime } from "./relativeTime";

describe("formatRelativeTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'today' when the stored YYYY-MM-DD matches today's local date", () => {
    // Pin "now" to a time later in the day to guarantee > 24 hours have
    // elapsed since UTC midnight of the same calendar day — this is the
    // exact scenario from #133.
    vi.setSystemTime(new Date(2026, 3, 14, 21, 0, 0)); // April 14, 2026, 9 PM local
    expect(formatRelativeTime("2026-04-14")).toBe("today");
  });

  it("returns 'yesterday' when the stored date is one calendar day before today", () => {
    vi.setSystemTime(new Date(2026, 3, 15, 10, 0, 0)); // April 15, 2026, 10 AM local
    expect(formatRelativeTime("2026-04-14")).toBe("yesterday");
  });

  it("returns 'Nd ago' for workouts 2-6 calendar days old", () => {
    vi.setSystemTime(new Date(2026, 3, 15, 10, 0, 0));
    expect(formatRelativeTime("2026-04-12")).toBe("3d ago");
  });

  it("uses calendar days, not rolling 24-hour windows", () => {
    // Workout stored as April 14 (UTC-sliced), viewed at 12:30 AM local on
    // April 15 — only a few hours after midnight, but a full calendar day later.
    vi.setSystemTime(new Date(2026, 3, 15, 0, 30, 0));
    expect(formatRelativeTime("2026-04-14")).toBe("yesterday");
  });

  it("returns 'Xm ago' for full timestamps within the last hour", () => {
    // Build "now" and the input from the same local Date components so the
    // assertion holds in any runner timezone — a hard-coded UTC literal would
    // shift across the local day boundary in far-west zones.
    vi.setSystemTime(new Date(2026, 3, 14, 21, 0, 0));
    const tenMinutesAgo = new Date(2026, 3, 14, 20, 50, 0).toISOString();
    expect(formatRelativeTime(tenMinutesAgo)).toBe("10m ago");
  });

  it("returns 'Xh ago' for full timestamps earlier the same day", () => {
    vi.setSystemTime(new Date(2026, 3, 14, 21, 0, 0));
    const threeHoursAgo = new Date(2026, 3, 14, 18, 0, 0).toISOString();
    expect(formatRelativeTime(threeHoursAgo)).toBe("3h ago");
  });
});
