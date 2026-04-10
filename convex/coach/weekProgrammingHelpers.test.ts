import { describe, expect, it } from "vitest";
import {
  cooldownBlockFromMovementIds,
  formatSessionTitle,
  inferArmPosition,
  type SessionType,
  sortForMinimalEquipmentSwitches,
  warmupBlockFromMovementIds,
} from "./weekProgrammingHelpers";
import { TONAL_REST_MOVEMENT_ID } from "../tonal/transforms";

// weekStartDate is accepted by the signature but not used in the output — any string works.
const ANY_WEEK = "2026-03-09";

// ---------------------------------------------------------------------------
// formatSessionTitle
// ---------------------------------------------------------------------------

describe("formatSessionTitle — single-word session types", () => {
  it("formats push session on Monday (dayIndex 0) as 'Push – Monday'", () => {
    expect(formatSessionTitle("push", ANY_WEEK, 0)).toBe("Push – Monday");
  });

  it("formats pull session on Tuesday (dayIndex 1) as 'Pull – Tuesday'", () => {
    expect(formatSessionTitle("pull", ANY_WEEK, 1)).toBe("Pull – Tuesday");
  });

  it("formats legs session on Friday (dayIndex 4) as 'Legs – Friday'", () => {
    expect(formatSessionTitle("legs", ANY_WEEK, 4)).toBe("Legs – Friday");
  });

  it("formats upper session on Thursday (dayIndex 3) as 'Upper – Thursday'", () => {
    expect(formatSessionTitle("upper", ANY_WEEK, 3)).toBe("Upper – Thursday");
  });

  it("formats lower session on Saturday (dayIndex 5) as 'Lower – Saturday'", () => {
    expect(formatSessionTitle("lower", ANY_WEEK, 5)).toBe("Lower – Saturday");
  });
});

describe("formatSessionTitle — underscore session types", () => {
  it("replaces underscore with space for full_body on Wednesday (dayIndex 2)", () => {
    expect(formatSessionTitle("full_body", ANY_WEEK, 2)).toBe("Full body – Wednesday");
  });

  it("capitalises only the first letter of the label", () => {
    const result = formatSessionTitle("full_body", ANY_WEEK, 2);
    // "Full body" — 'b' should be lowercase
    expect(result).toMatch(/^Full body/);
  });
});

describe("formatSessionTitle — separator and day name", () => {
  it("uses an em-dash with surrounding spaces as separator", () => {
    const result = formatSessionTitle("push", ANY_WEEK, 0);
    expect(result).toContain(" – ");
  });

  it("includes the correct day name for each index 0-6", () => {
    const expected: [SessionType, string][] = [
      ["push", "Monday"],
      ["pull", "Tuesday"],
      ["legs", "Wednesday"],
      ["upper", "Thursday"],
      ["lower", "Friday"],
      ["push", "Saturday"],
      ["pull", "Sunday"],
    ];

    expected.forEach(([sessionType, dayName], dayIndex) => {
      expect(formatSessionTitle(sessionType, ANY_WEEK, dayIndex)).toContain(dayName);
    });
  });

  it("output format matches '<Label> – <DayName>' pattern", () => {
    const result = formatSessionTitle("push", ANY_WEEK, 0);
    expect(result).toMatch(/^[A-Z][a-z]+ – [A-Z][a-z]+$/);
  });
});

// ---------------------------------------------------------------------------
// inferArmPosition
// ---------------------------------------------------------------------------

describe("inferArmPosition", () => {
  it("classifies pulldowns as high", () => {
    expect(inferArmPosition({ name: "Lat Pulldown", muscleGroups: ["Back"] })).toBe("high");
  });

  it("classifies face pulls as high", () => {
    expect(inferArmPosition({ name: "Face Pull", muscleGroups: ["Shoulders"] })).toBe("high");
  });

  it("classifies squats as low", () => {
    expect(inferArmPosition({ name: "Goblet Squat", muscleGroups: ["Quads", "Glutes"] })).toBe(
      "low",
    );
  });

  it("classifies deadlifts as low", () => {
    expect(inferArmPosition({ name: "RDL", muscleGroups: ["Hamstrings", "Glutes"] })).toBe("low");
  });

  it("classifies leg exercises as low via muscle group fallback", () => {
    expect(inferArmPosition({ name: "Some Leg Move", muscleGroups: ["Quads"] })).toBe("low");
  });

  it("classifies chest press as mid (default)", () => {
    expect(inferArmPosition({ name: "Bench Press", muscleGroups: ["Chest", "Triceps"] })).toBe(
      "mid",
    );
  });

  it("classifies bicep curl as mid (default)", () => {
    expect(inferArmPosition({ name: "Bicep Curl", muscleGroups: ["Biceps"] })).toBe("mid");
  });
});

// ---------------------------------------------------------------------------
// sortForMinimalEquipmentSwitches
// ---------------------------------------------------------------------------

const catalogWithAccessories = [
  {
    id: "bench",
    name: "Bench Press",
    muscleGroups: ["Chest", "Triceps"],
    onMachineInfo: { accessory: "Smart Bar" },
  },
  {
    id: "curl",
    name: "Bicep Curl",
    muscleGroups: ["Biceps"],
    onMachineInfo: { accessory: "Handle" },
  },
  {
    id: "row",
    name: "Bent Over Row",
    muscleGroups: ["Back"],
    onMachineInfo: { accessory: "Smart Bar" },
  },
  {
    id: "fly",
    name: "Chest Fly",
    muscleGroups: ["Chest"],
    onMachineInfo: { accessory: "Handle" },
  },
  {
    id: "pushdown",
    name: "Tricep Pushdown",
    muscleGroups: ["Triceps"],
    onMachineInfo: { accessory: "Rope" },
  },
  {
    id: "pushup",
    name: "Pushup",
    muscleGroups: ["Chest", "Triceps"],
    // no onMachineInfo — bodyweight
  },
];

describe("sortForMinimalEquipmentSwitches", () => {
  it("groups exercises by accessory type", () => {
    const input = ["curl", "bench", "pushdown", "fly", "row"];
    const sorted = sortForMinimalEquipmentSwitches(input, catalogWithAccessories);

    const accessories = sorted.map((id) => {
      const m = catalogWithAccessories.find((c) => c.id === id)!;
      return m.onMachineInfo?.accessory ?? "bodyweight";
    });
    // Should be grouped: all of first-seen accessory, then next, then next
    // Input order: curl (Handle), bench (Smart Bar), pushdown (Rope), fly (Handle), row (Smart Bar)
    // First-seen order: Handle, Smart Bar, Rope
    expect(accessories).toEqual(["Handle", "Handle", "Smart Bar", "Smart Bar", "Rope"]);
  });

  it("puts bodyweight exercises together at their first-seen position", () => {
    const input = ["pushup", "curl", "fly"];
    const sorted = sortForMinimalEquipmentSwitches(input, catalogWithAccessories);

    const accessories = sorted.map((id) => {
      const m = catalogWithAccessories.find((c) => c.id === id)!;
      return m.onMachineInfo?.accessory ?? "bodyweight";
    });
    // pushup first-seen (bodyweight), curl (Handle), fly (Handle)
    expect(accessories).toEqual(["bodyweight", "Handle", "Handle"]);
  });

  it("applies arm position sort within same accessory group", () => {
    // Both use Smart Bar: bench (mid) and row (mid) — same position, stable order
    const input = ["row", "bench"];
    const sorted = sortForMinimalEquipmentSwitches(input, catalogWithAccessories);
    // Both mid position, same accessory — stable sort preserves input order
    expect(sorted).toEqual(["row", "bench"]);
  });

  it("handles empty input", () => {
    expect(sortForMinimalEquipmentSwitches([], catalogWithAccessories)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// warmupBlockFromMovementIds / cooldownBlockFromMovementIds - rest injection
// ---------------------------------------------------------------------------

const warmupCooldownCatalog = [
  { id: "curl", countReps: true, muscleGroups: ["Biceps"] },
  { id: "fly", countReps: true, muscleGroups: ["Chest"] },
  { id: "pushup", countReps: false, muscleGroups: ["Chest", "Triceps"] },
];

describe("warmupBlockFromMovementIds - rest injection", () => {
  it("injects 30s rest into single-exercise warmup block", () => {
    const blocks = warmupBlockFromMovementIds(["curl"], {
      catalog: warmupCooldownCatalog,
    });

    expect(blocks).toHaveLength(1);
    expect(blocks[0].exercises).toHaveLength(2);
    expect(blocks[0].exercises[0].movementId).toBe("curl");
    expect(blocks[0].exercises[0].warmUp).toBe(true);
    expect(blocks[0].exercises[1].movementId).toBe(TONAL_REST_MOVEMENT_ID);
    expect(blocks[0].exercises[1].duration).toBe(30);
    expect(blocks[0].exercises[1].sets).toBe(2); // WARMUP_SETS = 2
  });

  it("does not inject rest into multi-exercise warmup block", () => {
    const blocks = warmupBlockFromMovementIds(["curl", "fly"], {
      catalog: warmupCooldownCatalog,
    });

    expect(blocks).toHaveLength(1);
    expect(blocks[0].exercises).toHaveLength(2);
    expect(blocks[0].exercises[0].movementId).toBe("curl");
    expect(blocks[0].exercises[1].movementId).toBe("fly");
  });
});

describe("cooldownBlockFromMovementIds - no rest injection", () => {
  it("does not inject rest into single-exercise cooldown block", () => {
    const blocks = cooldownBlockFromMovementIds(["curl"], {
      catalog: warmupCooldownCatalog,
    });

    expect(blocks).toHaveLength(1);
    expect(blocks[0].exercises).toHaveLength(1);
    expect(blocks[0].exercises[0].movementId).toBe("curl");
  });
});
