import { describe, expect, it } from "vitest";
import { normalizeTargetArea } from "./targetArea";

describe("normalizeTargetArea", () => {
  it("title-cases a lowercase string", () => {
    expect(normalizeTargetArea("upper body")).toBe("Upper Body");
  });

  it("normalizes all-caps input", () => {
    expect(normalizeTargetArea("LOWER BODY")).toBe("Lower Body");
  });

  it("handles mixed case", () => {
    expect(normalizeTargetArea("full BODY")).toBe("Full Body");
  });

  it("collapses extra whitespace", () => {
    expect(normalizeTargetArea("  upper   body  ")).toBe("Upper Body");
  });

  it("handles single word", () => {
    expect(normalizeTargetArea("core")).toBe("Core");
  });

  it("returns Unknown for whitespace-only input", () => {
    expect(normalizeTargetArea("   ")).toBe("Unknown");
    expect(normalizeTargetArea("")).toBe("Unknown");
  });
});
