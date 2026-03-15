import { describe, expect, it } from "vitest";
import { computeWeeklyVolume, type MuscleVolumeEntry } from "./periodization";

// ---------------------------------------------------------------------------
// Test data builders
// ---------------------------------------------------------------------------

/** A single workout block with exercises. */
function block(exercises: { movementId: string; sets: number }[]) {
  return { exercises };
}

/** A catalog entry mapping a movement id to one or more muscle groups. */
function movement(id: string, muscleGroups: string[]) {
  return { id, muscleGroups };
}

// ---------------------------------------------------------------------------
// computeWeeklyVolume
// ---------------------------------------------------------------------------

describe("computeWeeklyVolume — empty input", () => {
  it("returns all muscle groups with 0 sets when weekBlocks is empty", () => {
    const result = computeWeeklyVolume([], []);

    expect(result.length).toBeGreaterThan(0);
    for (const entry of result) {
      expect(entry.weeklySets).toBe(0);
    }
  });

  it("marks every group as under when weekBlocks is empty", () => {
    const result = computeWeeklyVolume([], []);

    for (const entry of result) {
      expect(entry.status).toBe("under");
    }
  });

  it("returns an entry for each tracked muscle group even with no catalog matches", () => {
    const result = computeWeeklyVolume([[block([{ movementId: "m1", sets: 3 }])]], []);

    // Every group still appears; none accumulate sets because catalog is empty
    for (const entry of result) {
      expect(entry.weeklySets).toBe(0);
    }
  });
});

describe("computeWeeklyVolume — single workout", () => {
  it("counts 3 sets of a chest exercise as 3 Chest sets", () => {
    const catalog = [movement("bench", ["Chest"])];
    const weekBlocks = [[block([{ movementId: "bench", sets: 3 }])]];

    const result = computeWeeklyVolume(weekBlocks, catalog);
    const chest = result.find((e) => e.muscleGroup === "Chest");

    expect(chest).toBeDefined();
    expect(chest!.weeklySets).toBe(3);
  });

  it("attributes sets to every muscle group listed for a compound movement", () => {
    const catalog = [movement("bench-press", ["Chest", "Triceps"])];
    const weekBlocks = [[block([{ movementId: "bench-press", sets: 4 }])]];

    const result = computeWeeklyVolume(weekBlocks, catalog);
    const chest = result.find((e) => e.muscleGroup === "Chest");
    const triceps = result.find((e) => e.muscleGroup === "Triceps");

    expect(chest!.weeklySets).toBe(4);
    expect(triceps!.weeklySets).toBe(4);
  });

  it("includes recommendedMin and recommendedMax on every entry", () => {
    const result = computeWeeklyVolume([], []);

    for (const entry of result) {
      expect(typeof entry.recommendedMin).toBe("number");
      expect(typeof entry.recommendedMax).toBe("number");
      expect(entry.recommendedMax).toBeGreaterThanOrEqual(entry.recommendedMin);
    }
  });
});

describe("computeWeeklyVolume — multiple workouts accumulate", () => {
  it("sums sets across two workout days for the same muscle group", () => {
    const catalog = [movement("squat", ["Quads"])];
    // Two separate workout days in the week
    const weekBlocks = [
      [block([{ movementId: "squat", sets: 4 }])],
      [block([{ movementId: "squat", sets: 3 }])],
    ];

    const result = computeWeeklyVolume(weekBlocks, catalog);
    const quads = result.find((e) => e.muscleGroup === "Quads");

    expect(quads!.weeklySets).toBe(7);
  });

  it("sums sets across multiple blocks within the same workout day", () => {
    const catalog = [movement("rdl", ["Hamstrings"]), movement("curl", ["Hamstrings"])];
    // One day, two blocks
    const weekBlocks = [
      [block([{ movementId: "rdl", sets: 3 }]), block([{ movementId: "curl", sets: 2 }])],
    ];

    const result = computeWeeklyVolume(weekBlocks, catalog);
    const hamstrings = result.find((e) => e.muscleGroup === "Hamstrings");

    expect(hamstrings!.weeklySets).toBe(5);
  });

  it("accumulates sets for different muscle groups independently", () => {
    const catalog = [movement("row", ["Back"]), movement("lateral-raise", ["Shoulders"])];
    const weekBlocks = [
      [
        block([
          { movementId: "row", sets: 4 },
          { movementId: "lateral-raise", sets: 2 },
        ]),
      ],
    ];

    const result = computeWeeklyVolume(weekBlocks, catalog);
    const back = result.find((e) => e.muscleGroup === "Back");
    const shoulders = result.find((e) => e.muscleGroup === "Shoulders");

    expect(back!.weeklySets).toBe(4);
    expect(shoulders!.weeklySets).toBe(2);
  });
});

describe("computeWeeklyVolume — status thresholds", () => {
  // Chest: min=10, max=20 (from VOLUME_LANDMARKS)

  it("reports under when weekly sets are below the minimum", () => {
    const catalog = [movement("fly", ["Chest"])];
    const weekBlocks = [[block([{ movementId: "fly", sets: 5 }])]]; // 5 < 10

    const result = computeWeeklyVolume(weekBlocks, catalog);
    const chest = result.find((e) => e.muscleGroup === "Chest");

    expect(chest!.status).toBe("under");
  });

  it("reports optimal when weekly sets are within the recommended range", () => {
    const catalog = [movement("fly", ["Chest"])];
    const weekBlocks = [[block([{ movementId: "fly", sets: 15 }])]]; // 10 <= 15 <= 20

    const result = computeWeeklyVolume(weekBlocks, catalog);
    const chest = result.find((e) => e.muscleGroup === "Chest");

    expect(chest!.status).toBe("optimal");
  });

  it("reports optimal at exactly the minimum boundary", () => {
    const catalog = [movement("fly", ["Chest"])];
    const weekBlocks = [[block([{ movementId: "fly", sets: 10 }])]]; // exactly 10

    const result = computeWeeklyVolume(weekBlocks, catalog);
    const chest = result.find((e) => e.muscleGroup === "Chest");

    expect(chest!.status).toBe("optimal");
  });

  it("reports optimal at exactly the maximum boundary", () => {
    const catalog = [movement("fly", ["Chest"])];
    const weekBlocks = [[block([{ movementId: "fly", sets: 20 }])]]; // exactly 20

    const result = computeWeeklyVolume(weekBlocks, catalog);
    const chest = result.find((e) => e.muscleGroup === "Chest");

    expect(chest!.status).toBe("optimal");
  });

  it("reports over when weekly sets exceed the maximum", () => {
    const catalog = [movement("fly", ["Chest"])];
    const weekBlocks = [[block([{ movementId: "fly", sets: 25 }])]]; // 25 > 20

    const result = computeWeeklyVolume(weekBlocks, catalog);
    const chest = result.find((e) => e.muscleGroup === "Chest");

    expect(chest!.status).toBe("over");
  });

  it("reports under for a group not present in any workout block", () => {
    // Back gets 0 sets — should be under
    const catalog = [movement("bench", ["Chest"])];
    const weekBlocks = [[block([{ movementId: "bench", sets: 15 }])]];

    const result = computeWeeklyVolume(weekBlocks, catalog);
    const back = result.find((e) => e.muscleGroup === "Back");

    expect(back!.weeklySets).toBe(0);
    expect(back!.status).toBe("under");
  });
});

describe("computeWeeklyVolume — return shape", () => {
  it("returns a MuscleVolumeEntry for each tracked muscle group", () => {
    const result = computeWeeklyVolume([], []);
    const groups = result.map((e) => e.muscleGroup);

    // Spot-check key groups are present
    expect(groups).toContain("Chest");
    expect(groups).toContain("Back");
    expect(groups).toContain("Quads");
    expect(groups).toContain("Glutes");
  });

  it("each entry has the expected shape", () => {
    const result = computeWeeklyVolume([], []);
    const entry: MuscleVolumeEntry = result[0];

    expect(typeof entry.muscleGroup).toBe("string");
    expect(typeof entry.weeklySets).toBe("number");
    expect(typeof entry.recommendedMin).toBe("number");
    expect(typeof entry.recommendedMax).toBe("number");
    expect(["under", "optimal", "over"]).toContain(entry.status);
  });
});
