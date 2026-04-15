import { describe, expect, it } from "vitest";
import { getRecencyLabel, sanitizeTimezone } from "./timeDecay";

describe("getRecencyLabel", () => {
  it("returns 'today' for same-day timestamps", () => {
    const now = new Date("2026-03-16T15:00:00Z");
    expect(getRecencyLabel("2026-03-16T08:00:00Z", now)).toBe("today");
  });

  it("returns 'yesterday' for previous day", () => {
    const now = new Date("2026-03-16T15:00:00Z");
    expect(getRecencyLabel("2026-03-15T20:00:00Z", now)).toBe("yesterday");
  });

  it("returns 'this week' for 3 days ago", () => {
    const now = new Date("2026-03-16T15:00:00Z");
    expect(getRecencyLabel("2026-03-13T10:00:00Z", now)).toBe("this week");
  });

  it("returns 'last week' for 10 days ago", () => {
    const now = new Date("2026-03-16T15:00:00Z");
    expect(getRecencyLabel("2026-03-06T10:00:00Z", now)).toBe("last week");
  });

  it("returns 'older' for 20+ days ago", () => {
    const now = new Date("2026-03-16T15:00:00Z");
    expect(getRecencyLabel("2026-02-20T10:00:00Z", now)).toBe("older");
  });

  it("returns 'today' using user timezone near midnight UTC", () => {
    const now = new Date("2026-03-16T23:30:00Z");
    expect(getRecencyLabel("2026-03-16T20:00:00Z", now, "America/Los_Angeles")).toBe("today");
  });

  it("returns 'yesterday' using user timezone", () => {
    const now = new Date("2026-03-17T06:00:00Z");
    expect(getRecencyLabel("2026-03-16T02:00:00Z", now, "America/Los_Angeles")).toBe("yesterday");
  });

  it("returns 'today' near midnight in positive-UTC timezone", () => {
    const now = new Date("2026-03-15T22:00:00Z");
    expect(getRecencyLabel("2026-03-15T20:00:00Z", now, "Asia/Tokyo")).toBe("today");
  });
});

describe("sanitizeTimezone", () => {
  it("accepts valid IANA timezones", () => {
    expect(sanitizeTimezone("America/New_York")).toBe("America/New_York");
    expect(sanitizeTimezone("UTC")).toBe("UTC");
  });

  it("rejects invalid timezones", () => {
    expect(sanitizeTimezone("Not/A/Zone")).toBeUndefined();
    expect(sanitizeTimezone("")).toBeUndefined();
    expect(sanitizeTimezone(undefined)).toBeUndefined();
  });

  it("trims whitespace", () => {
    expect(sanitizeTimezone("  America/Chicago  ")).toBe("America/Chicago");
  });
});
