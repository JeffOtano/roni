import { describe, expect, it } from "vitest";
import type { BlockInput } from "../tonal/transforms";

/** Pure version of the swap logic from weekModifications.ts for unit testing. */
function swapMovementInBlocks(
  blocks: BlockInput[],
  oldMovementId: string,
  newMovementId: string,
): BlockInput[] {
  return blocks.map((block) => ({
    ...block,
    exercises: block.exercises.map((ex) =>
      ex.movementId === oldMovementId ? { ...ex, movementId: newMovementId } : ex,
    ),
  }));
}

describe("swapMovementInBlocks", () => {
  it("replaces the target movement ID", () => {
    const blocks: BlockInput[] = [
      {
        exercises: [
          { movementId: "aaa", sets: 3, reps: 10 },
          { movementId: "bbb", sets: 3, reps: 10 },
          { movementId: "ccc", sets: 3, reps: 12 },
        ],
      },
    ];
    const result = swapMovementInBlocks(blocks, "bbb", "ddd");
    expect(result[0].exercises[1].movementId).toBe("ddd");
    expect(result[0].exercises[0].movementId).toBe("aaa");
    expect(result[0].exercises[2].movementId).toBe("ccc");
  });

  it("preserves sets and reps on swapped exercise", () => {
    const blocks: BlockInput[] = [{ exercises: [{ movementId: "aaa", sets: 4, reps: 8 }] }];
    const result = swapMovementInBlocks(blocks, "aaa", "bbb");
    expect(result[0].exercises[0]).toEqual({
      movementId: "bbb",
      sets: 4,
      reps: 8,
    });
  });

  it("no-ops when movement ID not found", () => {
    const blocks: BlockInput[] = [{ exercises: [{ movementId: "aaa", sets: 3, reps: 10 }] }];
    const result = swapMovementInBlocks(blocks, "zzz", "bbb");
    expect(result).toEqual(blocks);
  });

  it("handles multiple blocks", () => {
    const blocks: BlockInput[] = [
      { exercises: [{ movementId: "aaa", sets: 3 }] },
      { exercises: [{ movementId: "aaa", sets: 4 }] },
    ];
    const result = swapMovementInBlocks(blocks, "aaa", "bbb");
    expect(result[0].exercises[0].movementId).toBe("bbb");
    expect(result[1].exercises[0].movementId).toBe("bbb");
  });

  it("preserves other exercise properties", () => {
    const blocks: BlockInput[] = [
      {
        exercises: [
          { movementId: "aaa", sets: 3, reps: 10, spotter: true, eccentric: true, warmUp: false },
        ],
      },
    ];
    const result = swapMovementInBlocks(blocks, "aaa", "bbb");
    expect(result[0].exercises[0].spotter).toBe(true);
    expect(result[0].exercises[0].eccentric).toBe(true);
    expect(result[0].exercises[0].warmUp).toBe(false);
  });
});

describe("day slot swap (pure logic)", () => {
  type DaySlot = { sessionType: string; status: string; workoutPlanId?: string };

  function swapDays(days: DaySlot[], from: number, to: number): DaySlot[] {
    const result = [...days];
    const temp = result[from];
    result[from] = result[to];
    result[to] = temp;
    return result;
  }

  it("swaps two day slots", () => {
    const days: DaySlot[] = [
      { sessionType: "push", status: "programmed", workoutPlanId: "wp1" },
      { sessionType: "rest", status: "programmed" },
      { sessionType: "pull", status: "programmed", workoutPlanId: "wp2" },
    ];
    const result = swapDays(days, 0, 2);
    expect(result[0].sessionType).toBe("pull");
    expect(result[2].sessionType).toBe("push");
    expect(result[0].workoutPlanId).toBe("wp2");
    expect(result[2].workoutPlanId).toBe("wp1");
  });

  it("swap with itself is a no-op", () => {
    const days: DaySlot[] = [{ sessionType: "push", status: "programmed", workoutPlanId: "wp1" }];
    const result = swapDays(days, 0, 0);
    expect(result).toEqual(days);
  });
});
