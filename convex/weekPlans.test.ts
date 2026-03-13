import { describe, expect, it } from "vitest";
import { getWeekStartDateString, isValidWeekStartDateString } from "./weekPlans";

describe("isValidWeekStartDateString", () => {
  it("accepts valid YYYY-MM-DD", () => {
    expect(isValidWeekStartDateString("2026-03-09")).toBe(true);
    expect(isValidWeekStartDateString("2025-01-01")).toBe(true);
  });

  it("rejects non-YYYY-MM-DD strings", () => {
    expect(isValidWeekStartDateString("not-a-date")).toBe(false);
    expect(isValidWeekStartDateString("03-09-2026")).toBe(false);
    expect(isValidWeekStartDateString("2026/03/09")).toBe(false);
  });

  it("rejects invalid calendar dates", () => {
    expect(isValidWeekStartDateString("2026-02-30")).toBe(false);
    expect(isValidWeekStartDateString("2026-13-01")).toBe(false);
  });
});

describe("getWeekStartDateString", () => {
  it("returns Monday for a Monday date", () => {
    const monday = new Date("2026-03-09T12:00:00Z");
    expect(getWeekStartDateString(monday)).toBe("2026-03-09");
  });

  it("returns previous Monday for a Wednesday", () => {
    const wednesday = new Date("2026-03-11T12:00:00Z");
    expect(getWeekStartDateString(wednesday)).toBe("2026-03-09");
  });

  it("returns Monday of the week containing a Sunday", () => {
    const sunday = new Date("2026-03-08T12:00:00Z");
    expect(getWeekStartDateString(sunday)).toBe("2026-03-02");
  });

  it("returns same week Monday for Saturday", () => {
    const saturday = new Date("2026-03-14T12:00:00Z");
    expect(getWeekStartDateString(saturday)).toBe("2026-03-09");
  });
});
