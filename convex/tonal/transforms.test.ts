import { describe, expect, it } from "vitest";
import { type BlockInput, expandBlocksToSets } from "./transforms";

describe("expandBlocksToSets single block and supersets", () => {
  it("expands a single exercise block", () => {
    const blocks: BlockInput[] = [
      {
        exercises: [{ movementId: "move-1", sets: 3, reps: 10 }],
      },
    ];
    const sets = expandBlocksToSets(blocks);

    expect(sets).toHaveLength(3);
    expect(sets[0].blockStart).toBe(true);
    expect(sets[0].blockNumber).toBe(1);
    expect(sets[0].repetition).toBe(1);
    expect(sets[0].repetitionTotal).toBe(3);
    expect(sets[0].prescribedReps).toBe(10);
    expect(sets[0].setGroup).toBe(1);
    expect(sets[0].round).toBe(1);
    expect(sets[1].blockStart).toBe(false);
    expect(sets[1].repetition).toBe(2);
    expect(sets[2].repetition).toBe(3);
  });

  it("expands a superset (2 exercises in one block)", () => {
    const blocks: BlockInput[] = [
      {
        exercises: [
          { movementId: "move-a", sets: 2, reps: 8 },
          { movementId: "move-b", sets: 2, reps: 12 },
        ],
      },
    ];
    const sets = expandBlocksToSets(blocks);

    expect(sets).toHaveLength(4);
    expect(sets[0]).toMatchObject({
      movementId: "move-a",
      blockStart: true,
      round: 1,
      setGroup: 1,
    });
    expect(sets[1]).toMatchObject({
      movementId: "move-b",
      blockStart: false,
      round: 1,
      setGroup: 2,
    });
    expect(sets[2]).toMatchObject({
      movementId: "move-a",
      blockStart: false,
      round: 2,
      setGroup: 1,
    });
    expect(sets[3]).toMatchObject({
      movementId: "move-b",
      blockStart: false,
      round: 2,
      setGroup: 2,
    });
  });
});

describe("expandBlocksToSets flags (warmUp, blocks, spotter, duration)", () => {
  it("applies warmUp flag to ALL sets of a warmUp exercise (matches Tonal MCP behavior)", () => {
    const blocks: BlockInput[] = [
      {
        exercises: [{ movementId: "move-1", sets: 3, reps: 10, warmUp: true }],
      },
    ];
    const sets = expandBlocksToSets(blocks);

    expect(sets[0].warmUp).toBe(true);
    expect(sets[1].warmUp).toBe(true);
    expect(sets[2].warmUp).toBe(true);
  });

  it("handles multiple blocks", () => {
    const blocks: BlockInput[] = [
      { exercises: [{ movementId: "move-1", sets: 2, reps: 10 }] },
      { exercises: [{ movementId: "move-2", sets: 2, reps: 8 }] },
    ];
    const sets = expandBlocksToSets(blocks);

    expect(sets).toHaveLength(4);
    expect(sets[0].blockNumber).toBe(1);
    expect(sets[1].blockNumber).toBe(1);
    expect(sets[2].blockNumber).toBe(2);
    expect(sets[2].blockStart).toBe(true);
    expect(sets[3].blockNumber).toBe(2);
  });

  it("handles spotter and eccentric flags", () => {
    const blocks: BlockInput[] = [
      {
        exercises: [{ movementId: "move-1", sets: 1, reps: 8, spotter: true, eccentric: true }],
      },
    ];
    const sets = expandBlocksToSets(blocks);

    expect(sets[0].spotter).toBe(true);
    expect(sets[0].eccentric).toBe(true);
  });

  it("handles duration-based exercises with prescribedResistanceLevel", () => {
    const blocks: BlockInput[] = [
      {
        exercises: [{ movementId: "move-1", sets: 2, duration: 30 }],
      },
    ];
    const sets = expandBlocksToSets(blocks);

    expect(sets[0].prescribedDuration).toBe(30);
    expect(sets[0].prescribedReps).toBeUndefined();
    expect(sets[0].prescribedResistanceLevel).toBe(5);
  });
});

describe("expandBlocksToSets defaults and fields", () => {
  it("defaults reps to 10 when not specified for rep-based exercises", () => {
    const blocks: BlockInput[] = [{ exercises: [{ movementId: "move-1", sets: 1 }] }];
    const sets = expandBlocksToSets(blocks);
    expect(sets[0].prescribedReps).toBe(10);
  });

  it("includes all required Tonal fields (burnout, chains, flex, dropSet, description)", () => {
    const blocks: BlockInput[] = [{ exercises: [{ movementId: "move-1", sets: 1, reps: 8 }] }];
    const sets = expandBlocksToSets(blocks);

    expect(sets[0].burnout).toBe(false);
    expect(sets[0].chains).toBe(false);
    expect(sets[0].flex).toBe(false);
    expect(sets[0].dropSet).toBe(false);
    expect(sets[0].description).toBe("");
  });

  it("handles uneven superset (different set counts)", () => {
    const blocks: BlockInput[] = [
      {
        exercises: [
          { movementId: "move-a", sets: 3, reps: 8 },
          { movementId: "move-b", sets: 2, reps: 12 },
        ],
      },
    ];
    const sets = expandBlocksToSets(blocks);

    expect(sets).toHaveLength(5);
    expect(sets[4]).toMatchObject({ movementId: "move-a", round: 3, setGroup: 1 });
  });

  it("sets weightPercentage to 100 for all sets", () => {
    const blocks: BlockInput[] = [{ exercises: [{ movementId: "move-1", sets: 2, reps: 10 }] }];
    const sets = expandBlocksToSets(blocks);

    expect(sets[0].weightPercentage).toBe(100);
    expect(sets[1].weightPercentage).toBe(100);
  });
});

describe("expandBlocksToSets alternating exercises", () => {
  it("doubles reps for alternating movements when catalog is provided", () => {
    const blocks: BlockInput[] = [{ exercises: [{ movementId: "alt-move", sets: 3, reps: 10 }] }];
    const catalog = [{ id: "alt-move", countReps: true, isAlternating: true }];
    const sets = expandBlocksToSets(blocks, catalog);

    expect(sets).toHaveLength(3);
    expect(sets[0].prescribedReps).toBe(20); // 10 per side × 2
    expect(sets[1].prescribedReps).toBe(20);
  });

  it("does not double reps for bilateral movements", () => {
    const blocks: BlockInput[] = [{ exercises: [{ movementId: "bi-move", sets: 2, reps: 10 }] }];
    const catalog = [{ id: "bi-move", countReps: true, isAlternating: false }];
    const sets = expandBlocksToSets(blocks, catalog);

    expect(sets[0].prescribedReps).toBe(10);
  });

  it("does not double reps without catalog", () => {
    const blocks: BlockInput[] = [{ exercises: [{ movementId: "move-1", sets: 2, reps: 10 }] }];
    const sets = expandBlocksToSets(blocks);

    expect(sets[0].prescribedReps).toBe(10);
  });
});

describe("expandBlocksToSets catalog-based duration correction", () => {
  it("uses duration for movements with countReps=false even when reps are specified", () => {
    const blocks: BlockInput[] = [{ exercises: [{ movementId: "pushup", sets: 2, reps: 10 }] }];
    const catalog = [{ id: "pushup", countReps: false, isAlternating: false }];
    const sets = expandBlocksToSets(blocks, catalog);

    expect(sets).toHaveLength(2);
    expect(sets[0].prescribedDuration).toBe(30);
    expect(sets[0].prescribedReps).toBeUndefined();
    expect(sets[0].prescribedResistanceLevel).toBe(5);
  });

  it("uses reps for movements with countReps=true", () => {
    const blocks: BlockInput[] = [{ exercises: [{ movementId: "bench", sets: 1, reps: 8 }] }];
    const catalog = [{ id: "bench", countReps: true, isAlternating: false }];
    const sets = expandBlocksToSets(blocks, catalog);

    expect(sets[0].prescribedReps).toBe(8);
    expect(sets[0].prescribedDuration).toBeUndefined();
  });

  it("uses explicit duration for duration-based movement", () => {
    const blocks: BlockInput[] = [{ exercises: [{ movementId: "pushup", sets: 1, duration: 45 }] }];
    const catalog = [{ id: "pushup", countReps: false, isAlternating: false }];
    const sets = expandBlocksToSets(blocks, catalog);

    expect(sets[0].prescribedDuration).toBe(45);
  });

  it("falls back to reps when movement is not in catalog", () => {
    const blocks: BlockInput[] = [{ exercises: [{ movementId: "unknown", sets: 1, reps: 12 }] }];
    const catalog = [{ id: "other", countReps: false, isAlternating: false }];
    const sets = expandBlocksToSets(blocks, catalog);

    expect(sets[0].prescribedReps).toBe(12);
    expect(sets[0].prescribedDuration).toBeUndefined();
  });
});

describe("expandBlocksToSets edge cases", () => {
  it("defaults reps via expandBlocksToSets are included in prescribedReps", () => {
    const blocks: BlockInput[] = [{ exercises: [{ movementId: "move-1", sets: 1, reps: 10 }] }];
    const sets = expandBlocksToSets(blocks);
    expect(sets[0].prescribedReps).toBe(10);
    expect(sets[0].prescribedDuration).toBeUndefined();
  });

  it("handles single set", () => {
    const blocks: BlockInput[] = [{ exercises: [{ movementId: "move-1", sets: 1, reps: 5 }] }];
    const sets = expandBlocksToSets(blocks);

    expect(sets).toHaveLength(1);
    expect(sets[0].blockStart).toBe(true);
    expect(sets[0].repetition).toBe(1);
    expect(sets[0].repetitionTotal).toBe(1);
  });
});
