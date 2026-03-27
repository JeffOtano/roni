import { describe, expect, it } from "vitest";
import {
  buildExerciseCatalogSection,
  capitalizeWorkoutType,
  formatExternalActivityLine,
  getHrIntensityLabel,
  SNAPSHOT_MAX_CHARS,
  type SnapshotSection,
  trimSnapshot,
} from "./snapshotHelpers";
import type { ExternalActivity, Movement } from "../tonal/types";
import type { OwnedAccessories } from "../tonal/accessories";

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

function makeMovement(overrides: Partial<Movement> = {}): Movement {
  return {
    id: "move-1",
    name: "Bench Press",
    shortName: "Bench Press",
    muscleGroups: ["Chest"],
    inFreeLift: false,
    onMachine: true,
    countReps: true,
    isTwoSided: false,
    isBilateral: true,
    isAlternating: false,
    descriptionHow: "Press the bar",
    descriptionWhy: "Build chest",
    skillLevel: 3,
    publishState: "published",
    sortOrder: 1,
    ...overrides,
  };
}

function makeOwnedAccessories(overrides: Partial<OwnedAccessories> = {}): OwnedAccessories {
  return {
    smartHandles: true,
    smartBar: true,
    rope: true,
    roller: true,
    weightBar: true,
    pilatesLoops: true,
    ankleStraps: true,
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

  it("handles single-word input", () => {
    expect(capitalizeWorkoutType("yoga")).toBe("Yoga");
  });

  it("handles already capitalized input", () => {
    expect(capitalizeWorkoutType("Running")).toBe("Running");
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

// ---------------------------------------------------------------------------
// buildExerciseCatalogSection
// ---------------------------------------------------------------------------

describe("buildExerciseCatalogSection", () => {
  const machineInfo = {
    resistanceType: "cable",
    spotterDisabled: false,
    eccentricDisabled: false,
    chainsDisabled: false,
    burnoutDisabled: false,
  };

  it("returns null for empty movements array", () => {
    expect(buildExerciseCatalogSection([], undefined)).toBeNull();
  });

  it("groups published movements by accessory", () => {
    const movements: Movement[] = [
      makeMovement({
        name: "Bench Press",
        onMachineInfo: { accessory: "Smart Bar", ...machineInfo },
      }),
      makeMovement({
        id: "m2",
        name: "Bicep Curl",
        onMachineInfo: { accessory: "Smart Handles", ...machineInfo },
      }),
    ];
    const result = buildExerciseCatalogSection(movements, undefined);

    expect(result).not.toBeNull();
    expect(result!.lines.some((l) => l.includes("Bar"))).toBe(true);
    expect(result!.lines.some((l) => l.includes("Bench Press"))).toBe(true);
  });

  it("filters out unpublished movements", () => {
    const movements: Movement[] = [
      makeMovement({ name: "Published Move", publishState: "published" }),
      makeMovement({ id: "m2", name: "Draft Move", publishState: "draft" }),
    ];
    const result = buildExerciseCatalogSection(movements, undefined);

    expect(result!.lines.join("\n")).toContain("Published Move");
    expect(result!.lines.join("\n")).not.toContain("Draft Move");
  });

  it("filters out placeholder movements", () => {
    const movements: Movement[] = [
      makeMovement({ name: "Handle Move" }),
      makeMovement({ id: "m2", name: "Real Exercise" }),
    ];
    const result = buildExerciseCatalogSection(movements, undefined);

    expect(result!.lines.join("\n")).not.toContain("Handle Move");
    expect(result!.lines.join("\n")).toContain("Real Exercise");
  });

  it("filters movements for unowned accessories", () => {
    const movements: Movement[] = [
      makeMovement({ name: "Bar Ex", onMachineInfo: { accessory: "Smart Bar", ...machineInfo } }),
      makeMovement({
        id: "m2",
        name: "Handle Ex",
        onMachineInfo: { accessory: "Smart Handles", ...machineInfo },
      }),
    ];
    const result = buildExerciseCatalogSection(
      movements,
      makeOwnedAccessories({ smartBar: false }),
    );

    expect(result!.lines.join("\n")).not.toContain("Bar Ex");
    expect(result!.lines.join("\n")).toContain("Handle Ex");
  });

  it("returns null when all movements are filtered out", () => {
    expect(
      buildExerciseCatalogSection([makeMovement({ name: "Handle Move" })], undefined),
    ).toBeNull();
  });

  it("has priority 6.5", () => {
    const result = buildExerciseCatalogSection([makeMovement()], undefined);
    expect(result!.priority).toBe(6.5);
  });
});
