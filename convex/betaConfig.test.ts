import { describe, expect, it } from "vitest";
import { computeBetaCapacity } from "./betaConfig";

// The 50-user beta cap was removed as part of the BYOK open-source release.
// These tests lock in the new contract: capacity is never blocked, and the
// reported spotsLeft is effectively unbounded.

describe("computeBetaCapacity", () => {
  it("always reports signups as allowed", () => {
    expect(computeBetaCapacity().allowed).toBe(true);
  });

  it("reports spotsLeft as positive infinity", () => {
    expect(computeBetaCapacity().spotsLeft).toBe(Number.POSITIVE_INFINITY);
  });

  it("is deterministic across calls", () => {
    const first = computeBetaCapacity();
    const second = computeBetaCapacity();
    expect(first).toEqual(second);
  });
});
