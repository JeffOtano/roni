import { describe, expect, it } from "vitest";
import { correctDurationRepsMismatch, enrichPushErrorMessage, formatTonalTitle } from "./mutations";
import type { WorkoutSetInput } from "./types";

// ---------------------------------------------------------------------------
// enrichPushErrorMessage
// ---------------------------------------------------------------------------

describe("enrichPushErrorMessage", () => {
  it("includes title and movement IDs in the enriched message", () => {
    const result = enrichPushErrorMessage(
      "Tonal API 500: Internal Server Error",
      "Push Day - Monday",
      ["move-abc", "move-def", "move-ghi"],
    );

    expect(result).toContain("Push Day - Monday");
    expect(result).toContain("move-abc");
    expect(result).toContain("move-def");
    expect(result).toContain("move-ghi");
    expect(result).toContain("Tonal API 500");
  });

  it("includes all unique movement IDs", () => {
    const result = enrichPushErrorMessage("error", "Legs", ["m1", "m2", "m1"]);

    // Should deduplicate
    expect(result).toContain("m1");
    expect(result).toContain("m2");
  });
});

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

// ---------------------------------------------------------------------------
// correctDurationRepsMismatch
// ---------------------------------------------------------------------------

function makeSet(overrides: Partial<WorkoutSetInput> = {}): WorkoutSetInput {
  return {
    movementId: "move-1",
    blockNumber: 1,
    ...overrides,
  };
}

describe("correctDurationRepsMismatch", () => {
  const durationMovement = { id: "pushup-1", name: "Pushup", countReps: false };
  const repMovement = { id: "bench-1", name: "Bench Press", countReps: true };

  it("corrects a duration-based movement that has prescribedReps", () => {
    const sets = [makeSet({ movementId: "pushup-1", prescribedReps: 10 })];

    const corrections = correctDurationRepsMismatch(sets, [durationMovement]);

    expect(corrections).toBe(1);
    expect(sets[0].prescribedReps).toBeUndefined();
    expect(sets[0].prescribedDuration).toBe(30);
    expect(sets[0].prescribedResistanceLevel).toBe(5);
  });

  it("preserves existing prescribedDuration when correcting", () => {
    const sets = [makeSet({ movementId: "pushup-1", prescribedReps: 10, prescribedDuration: 45 })];

    correctDurationRepsMismatch(sets, [durationMovement]);

    expect(sets[0].prescribedDuration).toBe(45);
  });

  it("does not touch rep-based movements", () => {
    const sets = [makeSet({ movementId: "bench-1", prescribedReps: 8 })];

    const corrections = correctDurationRepsMismatch(sets, [repMovement]);

    expect(corrections).toBe(0);
    expect(sets[0].prescribedReps).toBe(8);
    expect(sets[0].prescribedDuration).toBeUndefined();
  });

  it("does not touch movements not in catalog", () => {
    const sets = [makeSet({ movementId: "unknown", prescribedReps: 10 })];

    const corrections = correctDurationRepsMismatch(sets, [durationMovement]);

    expect(corrections).toBe(0);
    expect(sets[0].prescribedReps).toBe(10);
  });

  it("handles empty sets array", () => {
    const corrections = correctDurationRepsMismatch([], [durationMovement]);

    expect(corrections).toBe(0);
  });

  it("corrects multiple sets in one pass", () => {
    const sets = [
      makeSet({ movementId: "pushup-1", prescribedReps: 10 }),
      makeSet({ movementId: "bench-1", prescribedReps: 8 }),
      makeSet({ movementId: "pushup-1", prescribedReps: 12 }),
    ];

    const corrections = correctDurationRepsMismatch(sets, [durationMovement, repMovement]);

    expect(corrections).toBe(2);
    expect(sets[0].prescribedReps).toBeUndefined();
    expect(sets[1].prescribedReps).toBe(8);
    expect(sets[2].prescribedReps).toBeUndefined();
  });
});
