import { describe, expect, it } from "vitest";
import {
  buildExerciseCatalogSection,
  formatExternalActivityLine,
  getHrIntensityLabel,
  getRecencyLabel,
  type SnapshotSection,
  trimSnapshot,
} from "./context";
import { computeAge } from "./snapshotHelpers";
import type { ExternalActivity, Movement } from "../tonal/types";
import type { OwnedAccessories } from "../tonal/accessories";

describe("trimSnapshot", () => {
  const makeSection = (priority: number, text: string): SnapshotSection => ({
    priority,
    lines: [text],
  });

  it("returns all sections when under budget", () => {
    const sections = [
      makeSection(1, "User: Alice | 65in/140lbs"),
      makeSection(5, "Training Block: Building Week 2/4"),
    ];
    const result = trimSnapshot(sections, 4000);
    expect(result).toContain("Alice");
    expect(result).toContain("Training Block");
  });

  it("drops lowest-priority sections first when over budget", () => {
    const sections = [
      makeSection(1, "User: Alice | 65in/140lbs"),
      makeSection(11, "Missed: Monday Push was programmed but not completed"),
      makeSection(10, "Performance: Volume up 15%"),
    ];
    const result = trimSnapshot(sections, 80);
    expect(result).toContain("Alice");
    expect(result).not.toContain("Missed");
    expect(result).not.toContain("Performance");
  });

  it("keeps header and footer regardless of budget", () => {
    const sections = [makeSection(1, "User: Alice")];
    const result = trimSnapshot(sections, 10);
    expect(result).toContain("=== TRAINING SNAPSHOT ===");
    expect(result).toContain("=== END SNAPSHOT ===");
    expect(result).not.toContain("Alice");
  });

  it("handles empty sections array", () => {
    const result = trimSnapshot([], 4000);
    expect(result).toContain("=== TRAINING SNAPSHOT ===");
    expect(result).toContain("=== END SNAPSHOT ===");
  });

  it("drops multiple low-priority sections to fit budget", () => {
    const sections = [
      makeSection(1, "User: Alice"),
      makeSection(3, "Injuries: left shoulder (mild)"),
      makeSection(7, "Scores: Upper 450, Lower 380"),
      makeSection(8, "Readiness: Chest 85, Back 72"),
      makeSection(9, "Workout: 2026-03-15 | Push Day"),
      makeSection(10, "Performance: Volume up 15%"),
      makeSection(11, "Missed: Monday Push"),
    ];
    // Budget of 150 should fit header(25)+footer(18)+2newlines + User(12) + Injuries(31) + Scores(28) = ~116
    const result = trimSnapshot(sections, 150);
    expect(result).toContain("Alice");
    expect(result).toContain("Injuries");
    expect(result).not.toContain("Missed");
    expect(result).not.toContain("Performance");
  });
});

// HR intensity labels

describe("getHrIntensityLabel", () => {
  it("returns null for zero HR", () => {
    expect(getHrIntensityLabel(0)).toBeNull();
  });

  it("returns 'light' for HR below 100", () => {
    expect(getHrIntensityLabel(90)).toBe("light");
  });

  it("returns 'moderate' for HR between 100 and 130", () => {
    expect(getHrIntensityLabel(115)).toBe("moderate");
  });

  it("returns 'vigorous' for HR above 130", () => {
    expect(getHrIntensityLabel(145)).toBe("vigorous");
  });

  it("returns 'moderate' at exactly 100", () => {
    expect(getHrIntensityLabel(100)).toBe("moderate");
  });

  it("returns 'vigorous' at exactly 131", () => {
    expect(getHrIntensityLabel(131)).toBe("vigorous");
  });
});

// Format line

describe("formatExternalActivityLine", () => {
  function makeExternal(overrides: Partial<ExternalActivity> = {}): ExternalActivity {
    return {
      id: "ext-1",
      userId: "user-1",
      workoutType: "pickleball",
      beginTime: "2026-03-15T14:00:00Z",
      endTime: "2026-03-15T16:00:00Z",
      timezone: "America/Denver",
      activeDuration: 7200,
      totalDuration: 7200,
      distance: 0,
      activeCalories: 0,
      totalCalories: 1100,
      averageHeartRate: 140,
      source: "Apple Watch",
      externalId: "ext-id",
      deviceId: "device-1",
      ...overrides,
    };
  }

  it("formats a standard activity line", () => {
    const line = formatExternalActivityLine(makeExternal());
    expect(line).toContain("Pickleball");
    expect(line).toContain("Apple Watch");
    expect(line).toContain("120min");
    expect(line).toContain("1100 cal");
    expect(line).toContain("vigorous");
  });

  it("omits HR label when averageHeartRate is 0", () => {
    const line = formatExternalActivityLine(makeExternal({ averageHeartRate: 0 }));
    expect(line).not.toContain("Avg HR");
  });

  it("capitalizes and space-separates camelCase workout type", () => {
    const line = formatExternalActivityLine(
      makeExternal({ workoutType: "traditionalStrengthTraining" }),
    );
    expect(line).toContain("Traditional Strength Training");
  });
});

// Recency labels

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
});

// Exercise catalog section

describe("buildExerciseCatalogSection", () => {
  function makeMovement(overrides: Partial<Movement> = {}): Movement {
    return {
      id: "m-1",
      name: "Bench Press",
      shortName: "Bench Press",
      muscleGroups: ["Chest"],
      skillLevel: 1,
      publishState: "published",
      sortOrder: 1,
      onMachine: true,
      inFreeLift: false,
      countReps: true,
      isTwoSided: false,
      isBilateral: true,
      isAlternating: false,
      descriptionHow: "",
      descriptionWhy: "",
      onMachineInfo: {
        accessory: "Handle",
        resistanceType: "cable",
        spotterDisabled: false,
        eccentricDisabled: false,
        chainsDisabled: false,
        burnoutDisabled: false,
      },
      ...overrides,
    };
  }

  const allOwned: OwnedAccessories = {
    smartHandles: true,
    smartBar: true,
    rope: true,
    roller: true,
    weightBar: true,
    pilatesLoops: true,
    ankleStraps: true,
  };

  it("groups exercises by accessory display name", () => {
    const movements = [
      makeMovement({
        id: "1",
        name: "Bench Press",
        onMachineInfo: {
          accessory: "Handle",
          resistanceType: "cable",
          spotterDisabled: false,
          eccentricDisabled: false,
          chainsDisabled: false,
          burnoutDisabled: false,
        },
      }),
      makeMovement({
        id: "2",
        name: "Biceps Curl",
        onMachineInfo: {
          accessory: "Handle",
          resistanceType: "cable",
          spotterDisabled: false,
          eccentricDisabled: false,
          chainsDisabled: false,
          burnoutDisabled: false,
        },
      }),
      makeMovement({
        id: "3",
        name: "Seated Row",
        onMachineInfo: {
          accessory: "Rope",
          resistanceType: "cable",
          spotterDisabled: false,
          eccentricDisabled: false,
          chainsDisabled: false,
          burnoutDisabled: false,
        },
      }),
    ];
    const section = buildExerciseCatalogSection(movements, allOwned);
    expect(section).not.toBeNull();
    const text = section!.lines.join("\n");
    expect(text).toContain("Handles: Bench Press, Biceps Curl");
    expect(text).toContain("Rope: Seated Row");
  });

  it("filters out exercises requiring unowned accessories", () => {
    const noRope: OwnedAccessories = { ...allOwned, rope: false };
    const movements = [
      makeMovement({
        id: "1",
        name: "Bench Press",
        onMachineInfo: {
          accessory: "Handle",
          resistanceType: "cable",
          spotterDisabled: false,
          eccentricDisabled: false,
          chainsDisabled: false,
          burnoutDisabled: false,
        },
      }),
      makeMovement({
        id: "2",
        name: "Face Pull",
        onMachineInfo: {
          accessory: "Rope",
          resistanceType: "cable",
          spotterDisabled: false,
          eccentricDisabled: false,
          chainsDisabled: false,
          burnoutDisabled: false,
        },
      }),
    ];
    const section = buildExerciseCatalogSection(movements, noRope);
    expect(section).not.toBeNull();
    const text = section!.lines.join("\n");
    expect(text).toContain("Bench Press");
    expect(text).not.toContain("Face Pull");
  });

  it("excludes placeholder movements", () => {
    const movements = [
      makeMovement({ id: "1", name: "Bench Press" }),
      makeMovement({ id: "2", name: "Handle Move" }),
      makeMovement({ id: "3", name: "Rope Move" }),
    ];
    const section = buildExerciseCatalogSection(movements, allOwned);
    expect(section).not.toBeNull();
    const text = section!.lines.join("\n");
    expect(text).toContain("Bench Press");
    expect(text).not.toContain("Handle Move");
    expect(text).not.toContain("Rope Move");
  });

  it("excludes unpublished movements", () => {
    const movements = [
      makeMovement({ id: "1", name: "Bench Press", publishState: "published" }),
      makeMovement({ id: "2", name: "Secret Move", publishState: "draft" }),
    ];
    const section = buildExerciseCatalogSection(movements, allOwned);
    const text = section!.lines.join("\n");
    expect(text).toContain("Bench Press");
    expect(text).not.toContain("Secret Move");
  });

  it("puts exercises without onMachineInfo in Bodyweight group", () => {
    const movements = [makeMovement({ id: "1", name: "Pushup", onMachineInfo: undefined })];
    const section = buildExerciseCatalogSection(movements, allOwned);
    const text = section!.lines.join("\n");
    expect(text).toContain("Bodyweight: Pushup");
  });

  it("returns null when no movements pass filters", () => {
    const section = buildExerciseCatalogSection([], allOwned);
    expect(section).toBeNull();
  });

  it("includes all accessories when owned is undefined", () => {
    const movements = [
      makeMovement({
        id: "1",
        name: "Face Pull",
        onMachineInfo: {
          accessory: "Rope",
          resistanceType: "cable",
          spotterDisabled: false,
          eccentricDisabled: false,
          chainsDisabled: false,
          burnoutDisabled: false,
        },
      }),
      makeMovement({
        id: "2",
        name: "Hip Abduction",
        onMachineInfo: {
          accessory: "AnkleStraps",
          resistanceType: "cable",
          spotterDisabled: false,
          eccentricDisabled: false,
          chainsDisabled: false,
          burnoutDisabled: false,
        },
      }),
    ];
    const section = buildExerciseCatalogSection(movements, undefined);
    expect(section).not.toBeNull();
    const text = section!.lines.join("\n");
    expect(text).toContain("Face Pull");
    expect(text).toContain("Hip Abduction");
  });

  it("sets priority to 6.5", () => {
    const movements = [makeMovement()];
    const section = buildExerciseCatalogSection(movements, allOwned);
    expect(section!.priority).toBe(6.5);
  });
});

// computeAge

describe("computeAge", () => {
  it("computes age correctly before birthday this year", () => {
    const now = new Date("2026-03-28");
    expect(computeAge("1993-12-15", now)).toBe(32);
  });

  it("computes age correctly after birthday this year", () => {
    const now = new Date("2026-03-28");
    expect(computeAge("1993-01-10", now)).toBe(33);
  });

  it("returns null for undefined dateOfBirth", () => {
    expect(computeAge(undefined, new Date())).toBeNull();
  });

  it("returns null for invalid date string", () => {
    expect(computeAge("not-a-date", new Date())).toBeNull();
  });
});
