import { describe, expect, it } from "vitest";
import { validateMovementIds, validateWorkoutBlocks } from "./validation";
import type { BlockInput } from "./transforms";
import { TONAL_REST_MOVEMENT_ID } from "./transforms";

// ---------------------------------------------------------------------------
// Test data builders
// ---------------------------------------------------------------------------

const mockCatalog = [
  { id: "uuid-1", name: "Bench Press" },
  { id: "uuid-2", name: "Squat" },
  { id: "uuid-3", name: "Deadlift" },
  { id: TONAL_REST_MOVEMENT_ID, name: "Rest", countReps: false, onMachine: false },
];

function block(movementIds: string[], sets = 3): BlockInput {
  return {
    exercises: movementIds.map((movementId) => ({ movementId, sets })),
  };
}

// ---------------------------------------------------------------------------
// validateMovementIds
// ---------------------------------------------------------------------------

describe("validateMovementIds", () => {
  it("returns valid for known IDs", () => {
    const result = validateMovementIds(["uuid-1", "uuid-2"], mockCatalog);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("returns invalid for unknown IDs", () => {
    const result = validateMovementIds(["uuid-1", "uuid-999"], mockCatalog);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("uuid-999");
  });

  it("returns valid for empty array", () => {
    const result = validateMovementIds([], mockCatalog);
    expect(result.valid).toBe(true);
  });

  it("catches multiple invalid IDs", () => {
    const result = validateMovementIds(["bad-1", "uuid-1", "bad-2"], mockCatalog);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(2);
  });

  it("error message names the specific unknown movementId", () => {
    const result = validateMovementIds(["ai-invented-movement"], mockCatalog);
    expect(result.errors[0]).toBe("Unknown movementId: ai-invented-movement");
  });

  it("does not include valid IDs in errors", () => {
    const result = validateMovementIds(["uuid-1", "bad-id"], mockCatalog);
    expect(result.errors.some((e) => e.includes("uuid-1"))).toBe(false);
  });

  it("returns valid false when catalog is empty and any ID is provided", () => {
    const result = validateMovementIds(["uuid-1"], []);
    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// validateWorkoutBlocks
// ---------------------------------------------------------------------------

describe("validateWorkoutBlocks — valid blocks", () => {
  it("returns valid true when all block movements exist in the catalog", () => {
    const blocks = [block(["uuid-1", "uuid-2"]), block(["uuid-3"])];

    const result = validateWorkoutBlocks(blocks, mockCatalog);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("returns valid true for empty blocks array", () => {
    const result = validateWorkoutBlocks([], mockCatalog);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("returns valid true for blocks with empty exercise arrays", () => {
    const emptyBlock: BlockInput = { exercises: [] };
    const result = validateWorkoutBlocks([emptyBlock], mockCatalog);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("accepts blocks containing the Rest movement", () => {
    const blocks = [block(["uuid-1", TONAL_REST_MOVEMENT_ID])];
    const result = validateWorkoutBlocks(blocks, mockCatalog);
    expect(result.valid).toBe(true);
  });
});

describe("validateWorkoutBlocks — invalid blocks", () => {
  it("returns valid false when a block contains an unknown movement ID", () => {
    const blocks = [block(["uuid-1", "ai-invented-exercise"])];

    const result = validateWorkoutBlocks(blocks, mockCatalog);

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toBe("Unknown movementId: ai-invented-exercise");
  });

  it("reports invalid IDs across multiple blocks", () => {
    const blocks = [block(["fake-1", "uuid-1"]), block(["uuid-2", "fake-2"])];

    const result = validateWorkoutBlocks(blocks, mockCatalog);

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(2);
    expect(result.errors).toContain("Unknown movementId: fake-1");
    expect(result.errors).toContain("Unknown movementId: fake-2");
  });

  it("only reports the invalid IDs, not the valid ones", () => {
    const blocks = [block(["uuid-1", "ghost-movement", "uuid-2"])];

    const result = validateWorkoutBlocks(blocks, mockCatalog);

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toBe("Unknown movementId: ghost-movement");
  });

  it("reports all errors when no movement in any block exists in catalog", () => {
    const blocks = [block(["fake-a", "fake-b"]), block(["fake-c"])];

    const result = validateWorkoutBlocks(blocks, []);

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(3);
  });
});
