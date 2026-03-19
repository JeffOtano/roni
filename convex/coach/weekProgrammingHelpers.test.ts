import { describe, expect, it } from "vitest";
import {
  blocksFromMovementIds,
  formatSessionTitle,
  inferArmPosition,
  type SessionType,
  sortForMinimalArmAdjustments,
  sortForMinimalEquipmentSwitches,
} from "./weekProgrammingHelpers";

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
// sortForMinimalArmAdjustments (deprecated — delegates to new function)
// ---------------------------------------------------------------------------

describe("sortForMinimalArmAdjustments (backward compatibility)", () => {
  it("delegates to sortForMinimalEquipmentSwitches", () => {
    const input = ["curl", "bench", "fly"];
    const newResult = sortForMinimalEquipmentSwitches(input, catalogWithAccessories);
    const oldResult = sortForMinimalArmAdjustments(input, catalogWithAccessories);
    expect(oldResult).toEqual(newResult);
  });

  it("handles empty input", () => {
    expect(sortForMinimalArmAdjustments([], catalogWithAccessories)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// blocksFromMovementIds
// ---------------------------------------------------------------------------

const blockCatalog = [
  {
    id: "bench",
    countReps: true,
    onMachineInfo: { accessory: "Smart Bar" },
  },
  {
    id: "row",
    countReps: true,
    onMachineInfo: { accessory: "Smart Bar" },
  },
  {
    id: "curl",
    countReps: true,
    onMachineInfo: { accessory: "Handle" },
  },
  {
    id: "fly",
    countReps: true,
    onMachineInfo: { accessory: "Handle" },
  },
  {
    id: "extension",
    countReps: true,
    onMachineInfo: { accessory: "Handle" },
  },
  {
    id: "pushdown",
    countReps: true,
    onMachineInfo: { accessory: "Rope" },
  },
  {
    id: "pushup",
    countReps: false,
    // no onMachineInfo — bodyweight/duration-based
  },
];

describe("blocksFromMovementIds", () => {
  it("returns empty array for empty input", () => {
    expect(blocksFromMovementIds([])).toEqual([]);
  });

  it("groups exercises by accessory into 2-exercise superset blocks", () => {
    // Pre-sorted by accessory: Smart Bar x2, Handle x2
    const ids = ["bench", "row", "curl", "fly"];
    const blocks = blocksFromMovementIds(ids, undefined, { catalog: blockCatalog });

    expect(blocks).toHaveLength(2);
    expect(blocks[0].exercises.map((e) => e.movementId)).toEqual(["bench", "row"]);
    expect(blocks[1].exercises.map((e) => e.movementId)).toEqual(["curl", "fly"]);
  });

  it("puts odd exercise in its own straight-set block", () => {
    // Handle x3 = 2 in superset + 1 solo
    const ids = ["curl", "fly", "extension"];
    const blocks = blocksFromMovementIds(ids, undefined, { catalog: blockCatalog });

    expect(blocks).toHaveLength(2);
    expect(blocks[0].exercises).toHaveLength(2);
    expect(blocks[1].exercises).toHaveLength(1);
    expect(blocks[1].exercises[0].movementId).toBe("extension");
  });

  it("creates separate blocks per accessory group", () => {
    // Smart Bar x1, Handle x1, Rope x1 = 3 solo blocks
    const ids = ["bench", "curl", "pushdown"];
    const blocks = blocksFromMovementIds(ids, undefined, { catalog: blockCatalog });

    expect(blocks).toHaveLength(3);
    expect(blocks[0].exercises[0].movementId).toBe("bench");
    expect(blocks[1].exercises[0].movementId).toBe("curl");
    expect(blocks[2].exercises[0].movementId).toBe("pushdown");
  });

  it("groups bodyweight exercises together", () => {
    const ids = ["pushup", "curl"];
    const blocks = blocksFromMovementIds(ids, undefined, { catalog: blockCatalog });

    // pushup = bodyweight group (1 block), curl = Handle group (1 block)
    expect(blocks).toHaveLength(2);
    expect(blocks[0].exercises[0].movementId).toBe("pushup");
    expect(blocks[1].exercises[0].movementId).toBe("curl");
  });

  it("uses duration for non-countReps exercises", () => {
    const ids = ["pushup"];
    const blocks = blocksFromMovementIds(ids, undefined, { catalog: blockCatalog });

    expect(blocks[0].exercises[0].duration).toBe(30);
    expect(blocks[0].exercises[0].reps).toBeUndefined();
  });

  it("applies suggested reps from progressive overload", () => {
    const ids = ["bench"];
    const suggestions = [{ movementId: "bench", suggestedReps: 8 }];
    const blocks = blocksFromMovementIds(ids, suggestions, { catalog: blockCatalog });

    expect(blocks[0].exercises[0].reps).toBe(8);
  });

  it("defaults to 3 sets and 10 reps without suggestions", () => {
    const ids = ["bench"];
    const blocks = blocksFromMovementIds(ids, undefined, { catalog: blockCatalog });

    expect(blocks[0].exercises[0].sets).toBe(3);
    expect(blocks[0].exercises[0].reps).toBe(10);
  });

  it("works without catalog (all exercises in one accessory group)", () => {
    const ids = ["a", "b", "c", "d"];
    const blocks = blocksFromMovementIds(ids);

    // Without catalog, all are same accessory group (bodyweight fallback), paired into supersets
    expect(blocks).toHaveLength(2);
    expect(blocks[0].exercises.map((e) => e.movementId)).toEqual(["a", "b"]);
    expect(blocks[1].exercises.map((e) => e.movementId)).toEqual(["c", "d"]);
  });
});
