import { describe, expect, it } from "vitest";
import { formatTonalTitle } from "./mutations";

// ---------------------------------------------------------------------------
// formatTonalTitle
// ---------------------------------------------------------------------------

describe("formatTonalTitle", () => {
  it("prefixes the title with a short month-day date", () => {
    const date = new Date("2026-03-14T12:00:00Z");

    const result = formatTonalTitle("Push Day", date);

    // en-US locale: "Mar 14 · Push Day"
    expect(result).toBe("Mar 14 · Push Day");
  });

  it("uses the middle dot separator between date and title", () => {
    const date = new Date("2026-01-01T00:00:00Z");

    const result = formatTonalTitle("Leg Day", date);

    expect(result).toContain(" · ");
  });

  it("formats the date as abbreviated month followed by day number", () => {
    const date = new Date("2026-07-04T12:00:00Z");

    const result = formatTonalTitle("Independence Workout", date);

    expect(result).toMatch(/^Jul 4 · /);
  });

  it("handles single-digit day without zero-padding", () => {
    const date = new Date("2026-02-05T12:00:00Z");

    const result = formatTonalTitle("Core Blast", date);

    expect(result).toMatch(/^Feb 5 · /);
  });

  it("handles double-digit day correctly", () => {
    const date = new Date("2026-11-22T12:00:00Z");

    const result = formatTonalTitle("Total Body", date);

    expect(result).toMatch(/^Nov 22 · /);
  });

  it("appends the full title verbatim after the separator", () => {
    const date = new Date("2026-03-14T12:00:00Z");
    const title = "Upper Body — Hypertrophy Block A";

    const result = formatTonalTitle(title, date);

    expect(result.endsWith(title)).toBe(true);
  });

  it("handles an empty title string", () => {
    const date = new Date("2026-03-14T12:00:00Z");

    const result = formatTonalTitle("", date);

    expect(result).toBe("Mar 14 · ");
  });

  it("defaults to current date when no date argument is provided", () => {
    // Call with no date — should not throw and must contain the separator
    const result = formatTonalTitle("Quick Check");

    expect(result).toContain(" · ");
    expect(result.endsWith("Quick Check")).toBe(true);
  });
});
