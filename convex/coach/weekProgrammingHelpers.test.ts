import { describe, expect, it } from "vitest";
import {
  formatSessionTitle,
  inferArmPosition,
  type SessionType,
  sortForMinimalArmAdjustments,
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
// sortForMinimalArmAdjustments
// ---------------------------------------------------------------------------

describe("sortForMinimalArmAdjustments", () => {
  const catalog = [
    { id: "squat", name: "Goblet Squat", muscleGroups: ["Quads", "Glutes"] },
    { id: "pulldown", name: "Lat Pulldown", muscleGroups: ["Back"] },
    { id: "press", name: "Bench Press", muscleGroups: ["Chest", "Triceps"] },
    { id: "rdl", name: "RDL", muscleGroups: ["Hamstrings", "Glutes"] },
    { id: "curl", name: "Bicep Curl", muscleGroups: ["Biceps"] },
  ];

  it("groups low exercises before mid before high", () => {
    const input = ["pulldown", "press", "squat", "curl", "rdl"];
    const sorted = sortForMinimalArmAdjustments(input, catalog);

    // Low exercises first (squat, rdl), then mid (press, curl), then high (pulldown)
    const positions = sorted.map((id) => {
      const m = catalog.find((c) => c.id === id)!;
      return inferArmPosition(m);
    });
    expect(positions).toEqual(["low", "low", "mid", "mid", "high"]);
  });

  it("preserves relative order within the same position group", () => {
    const input = ["press", "curl"];
    const sorted = sortForMinimalArmAdjustments(input, catalog);
    expect(sorted).toEqual(["press", "curl"]); // both mid, order preserved
  });

  it("handles empty input", () => {
    expect(sortForMinimalArmAdjustments([], catalog)).toEqual([]);
  });
});
