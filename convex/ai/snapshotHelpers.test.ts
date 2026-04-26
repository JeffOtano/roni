import { describe, expect, it } from "vitest";
import {
  capitalizeWorkoutType,
  computeAge,
  formatExternalActivityLine,
  getHrIntensityLabel,
  SNAPSHOT_MAX_CHARS,
  type SnapshotSection,
  trimSnapshot,
} from "./snapshotHelpers";
import type { ExternalActivity } from "../tonal/types";

// ---------------------------------------------------------------------------
// Test data builders
// ---------------------------------------------------------------------------

function makeExternalActivity(overrides: Partial<ExternalActivity> = {}): ExternalActivity {
  return {
    id: "ext-1",
    userId: "user-1",
    workoutType: "running",
    beginTime: "2026-03-27T07:00:00Z",
    endTime: "2026-03-27T07:30:00Z",
    timezone: "America/Los_Angeles",
    activeDuration: 1800,
    totalDuration: 1800,
    distance: 5000,
    activeCalories: 300,
    totalCalories: 350,
    averageHeartRate: 145,
    source: "Apple Watch",
    externalId: "ext-id-1",
    deviceId: "device-1",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// getHrIntensityLabel
// ---------------------------------------------------------------------------

describe("getHrIntensityLabel", () => {
  it("returns null for zero heart rate", () => {
    expect(getHrIntensityLabel(0)).toBeNull();
  });

  it("returns light for HR below 100", () => {
    expect(getHrIntensityLabel(80)).toBe("light");
    expect(getHrIntensityLabel(99)).toBe("light");
  });

  it("returns moderate for HR between 100 and 130", () => {
    expect(getHrIntensityLabel(100)).toBe("moderate");
    expect(getHrIntensityLabel(115)).toBe("moderate");
    expect(getHrIntensityLabel(130)).toBe("moderate");
  });

  it("returns vigorous for HR above 130", () => {
    expect(getHrIntensityLabel(131)).toBe("vigorous");
    expect(getHrIntensityLabel(180)).toBe("vigorous");
  });
});

// ---------------------------------------------------------------------------
// capitalizeWorkoutType
// ---------------------------------------------------------------------------

describe("capitalizeWorkoutType", () => {
  it("capitalizes a simple lowercase word", () => {
    expect(capitalizeWorkoutType("running")).toBe("Running");
  });

  it("splits camelCase into separate capitalized words", () => {
    expect(capitalizeWorkoutType("highIntensityIntervalTraining")).toBe(
      "High Intensity Interval Training",
    );
  });

  it("preserves acronym boundaries in camelCase labels", () => {
    expect(capitalizeWorkoutType("HIITWorkout")).toBe("HIIT Workout");
  });

  it("handles single-word input", () => {
    expect(capitalizeWorkoutType("yoga")).toBe("Yoga");
  });

  it("handles already capitalized input", () => {
    expect(capitalizeWorkoutType("Running")).toBe("Running");
  });

  it("normalizes Garmin-style uppercase enum labels", () => {
    expect(capitalizeWorkoutType("STRENGTH_TRAINING")).toBe("Strength Training");
    expect(capitalizeWorkoutType("INDOOR_CARDIO")).toBe("Indoor Cardio");
  });

  it("handles empty string", () => {
    expect(capitalizeWorkoutType("")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// formatExternalActivityLine
// ---------------------------------------------------------------------------

describe("formatExternalActivityLine", () => {
  it("includes date, type, source, duration, and calories", () => {
    const activity = makeExternalActivity({
      totalDuration: 1800,
      totalCalories: 350,
      distance: 0,
      averageHeartRate: 0,
    });
    const line = formatExternalActivityLine(activity);

    expect(line).toContain("2026-03-27");
    expect(line).toContain("Running");
    expect(line).toContain("Apple Watch");
    expect(line).toContain("30min");
    expect(line).toContain("350 cal");
  });

  it("includes distance in miles when distance is greater than zero", () => {
    const line = formatExternalActivityLine(makeExternalActivity({ distance: 5000 }));
    expect(line).toContain("3.1 mi");
  });

  it("omits distance when distance is zero", () => {
    const line = formatExternalActivityLine(makeExternalActivity({ distance: 0 }));
    expect(line).not.toMatch(/\d+\.\d+ mi/);
  });

  it("includes heart rate with intensity label when HR is non-zero", () => {
    const line = formatExternalActivityLine(makeExternalActivity({ averageHeartRate: 145 }));
    expect(line).toContain("Avg HR 145 (vigorous)");
  });

  it("omits heart rate when HR is zero", () => {
    const line = formatExternalActivityLine(makeExternalActivity({ averageHeartRate: 0 }));
    expect(line).not.toContain("HR");
  });

  it("omits calories when calories are zero", () => {
    const line = formatExternalActivityLine(makeExternalActivity({ totalCalories: 0 }));
    // Match a numeric calorie token specifically so unrelated substrings
    // (e.g. "Calorie Tracker" workout names) don't false-positive.
    expect(line).not.toMatch(/\d+\s*cal\b/i);
  });

  it("omits optional metrics when the source does not provide them", () => {
    const line = formatExternalActivityLine(
      makeExternalActivity({
        totalCalories: undefined,
        distance: undefined,
        averageHeartRate: undefined,
      }),
    );

    expect(line).toContain("30min");
    expect(line).not.toContain("cal");
    expect(line).not.toMatch(/\d+\.\d+ mi/);
    expect(line).not.toContain("HR");
  });
});

// ---------------------------------------------------------------------------
// trimSnapshot
// ---------------------------------------------------------------------------

describe("trimSnapshot", () => {
  it("includes all sections when within budget", () => {
    const sections: SnapshotSection[] = [
      { priority: 1, lines: ["Section A"] },
      { priority: 2, lines: ["Section B"] },
    ];
    const result = trimSnapshot(sections, 500);

    expect(result).toContain("Section A");
    expect(result).toContain("Section B");
    expect(result).toContain("=== TRAINING SNAPSHOT ===");
    expect(result).toContain("=== END SNAPSHOT ===");
  });

  it("drops lower priority sections when over budget", () => {
    const sections: SnapshotSection[] = [
      { priority: 1, lines: ["A".repeat(40)] },
      { priority: 12, lines: ["B".repeat(40)] },
    ];
    const headerFooterLen = "=== TRAINING SNAPSHOT ===".length + "=== END SNAPSHOT ===".length + 2;
    const result = trimSnapshot(sections, headerFooterLen + 42);

    expect(result).toContain("A".repeat(40));
    expect(result).not.toContain("B".repeat(40));
  });

  it("preserves priority order in output", () => {
    const sections: SnapshotSection[] = [
      { priority: 3, lines: ["Third"] },
      { priority: 1, lines: ["First"] },
      { priority: 2, lines: ["Second"] },
    ];
    const result = trimSnapshot(sections, 5000);

    expect(result.indexOf("First")).toBeLessThan(result.indexOf("Second"));
    expect(result.indexOf("Second")).toBeLessThan(result.indexOf("Third"));
  });

  it("returns only header and footer when no sections fit", () => {
    const result = trimSnapshot([{ priority: 1, lines: ["A".repeat(1000)] }], 50);

    expect(result).toContain("=== TRAINING SNAPSHOT ===");
    expect(result).not.toContain("A".repeat(1000));
  });

  it("handles empty sections array", () => {
    const result = trimSnapshot([], 500);
    expect(result).toContain("=== TRAINING SNAPSHOT ===");
    expect(result).toContain("=== END SNAPSHOT ===");
  });
});

// ---------------------------------------------------------------------------
// SNAPSHOT_MAX_CHARS
// ---------------------------------------------------------------------------

describe("SNAPSHOT_MAX_CHARS", () => {
  it("is a positive number", () => {
    expect(SNAPSHOT_MAX_CHARS).toBeGreaterThan(0);
  });
});

// computeAge
// ---------------------------------------------------------------------------

describe("computeAge", () => {
  // Fixed local-time date avoids UTC-midnight drift across CI timezones.
  const now = new Date(2026, 2, 28); // March 28, 2026

  it("computes age correctly before birthday this year", () => {
    expect(computeAge("1993-12-15", now)).toBe(32);
  });

  it("computes age correctly after birthday this year", () => {
    expect(computeAge("1993-01-10", now)).toBe(33);
  });

  it("returns null for undefined dateOfBirth", () => {
    expect(computeAge(undefined, now)).toBeNull();
  });

  it("returns null for invalid date string", () => {
    expect(computeAge("not-a-date", now)).toBeNull();
  });

  it("rejects impossible dates like Feb 30", () => {
    expect(computeAge("1993-02-30", now)).toBeNull();
  });

  it("rejects partial dates without day", () => {
    expect(computeAge("1993-06", now)).toBeNull();
  });

  it("rejects dates with trailing text", () => {
    expect(computeAge("1993-06-15T00:00:00Z", now)).toBeNull();
  });
});
