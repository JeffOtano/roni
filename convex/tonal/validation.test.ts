import { describe, expect, it } from "vitest";
import { validateMovementIds } from "./validation";

const mockCatalog = [
  { id: "uuid-1", name: "Bench Press" },
  { id: "uuid-2", name: "Squat" },
  { id: "uuid-3", name: "Deadlift" },
];

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
});
