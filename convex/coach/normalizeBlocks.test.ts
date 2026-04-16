import { describe, expect, it } from "vitest";
import { normalizeBlocksWithCountReps } from "./normalizeBlocks";

const COUNT_REPS = new Map<string, boolean>([
  ["rep-movement", true],
  ["duration-movement", false],
]);

describe("normalizeBlocksWithCountReps", () => {
  it("forces rep-based movements to reps and clears duration", () => {
    const blocks = [
      {
        exercises: [{ movementId: "rep-movement", sets: 4, duration: 30 }],
      },
    ];

    const result = normalizeBlocksWithCountReps(blocks, COUNT_REPS);

    expect(result[0].exercises[0]).toEqual({
      movementId: "rep-movement",
      sets: 4,
      reps: 10,
      duration: undefined,
    });
  });

  it("preserves existing reps for rep-based movements", () => {
    const blocks = [
      {
        exercises: [{ movementId: "rep-movement", sets: 3, reps: 12 }],
      },
    ];

    const result = normalizeBlocksWithCountReps(blocks, COUNT_REPS);

    expect(result[0].exercises[0].reps).toBe(12);
    expect(result[0].exercises[0].duration).toBeUndefined();
  });

  it("forces duration-based movements to duration and clears reps", () => {
    const blocks = [
      {
        exercises: [{ movementId: "duration-movement", sets: 3, reps: 10 }],
      },
    ];

    const result = normalizeBlocksWithCountReps(blocks, COUNT_REPS);

    expect(result[0].exercises[0]).toEqual({
      movementId: "duration-movement",
      sets: 3,
      duration: 30,
      reps: undefined,
    });
  });

  it("preserves existing duration for duration-based movements", () => {
    const blocks = [
      {
        exercises: [{ movementId: "duration-movement", sets: 2, duration: 45 }],
      },
    ];

    const result = normalizeBlocksWithCountReps(blocks, COUNT_REPS);

    expect(result[0].exercises[0].duration).toBe(45);
    expect(result[0].exercises[0].reps).toBeUndefined();
  });

  it("leaves unknown movements untouched", () => {
    const original = { movementId: "not-in-catalog", sets: 4, duration: 30 };
    const blocks = [{ exercises: [original] }];

    const result = normalizeBlocksWithCountReps(blocks, COUNT_REPS);

    expect(result[0].exercises[0]).toBe(original);
  });

  it("preserves modifier flags while correcting rep/duration mismatch", () => {
    const blocks = [
      {
        exercises: [
          {
            movementId: "rep-movement",
            sets: 4,
            duration: 30,
            eccentric: true,
            spotter: true,
          },
        ],
      },
    ];

    const result = normalizeBlocksWithCountReps(blocks, COUNT_REPS);

    expect(result[0].exercises[0]).toMatchObject({
      reps: 10,
      duration: undefined,
      eccentric: true,
      spotter: true,
    });
  });

  it("normalizes exercises across multiple blocks independently", () => {
    const blocks = [
      { exercises: [{ movementId: "rep-movement", sets: 4, duration: 30 }] },
      { exercises: [{ movementId: "duration-movement", sets: 2, reps: 10 }] },
    ];

    const result = normalizeBlocksWithCountReps(blocks, COUNT_REPS);

    expect(result[0].exercises[0].reps).toBe(10);
    expect(result[0].exercises[0].duration).toBeUndefined();
    expect(result[1].exercises[0].duration).toBe(30);
    expect(result[1].exercises[0].reps).toBeUndefined();
  });
});
