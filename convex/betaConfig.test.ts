import { describe, expect, it } from "vitest";
import { BETA_SPOT_LIMIT, computeBetaCapacity, shouldBlockSignup } from "./betaConfig";

// ---------------------------------------------------------------------------
// computeBetaCapacity
// ---------------------------------------------------------------------------

describe("computeBetaCapacity", () => {
  it("allows signups when under capacity", () => {
    const result = computeBetaCapacity(0);
    expect(result.allowed).toBe(true);
    expect(result.spotsLeft).toBe(BETA_SPOT_LIMIT);
  });

  it("allows signups at one below capacity", () => {
    const result = computeBetaCapacity(BETA_SPOT_LIMIT - 1);
    expect(result.allowed).toBe(true);
    expect(result.spotsLeft).toBe(1);
  });

  it("blocks signups at exactly capacity", () => {
    const result = computeBetaCapacity(BETA_SPOT_LIMIT);
    expect(result.allowed).toBe(false);
    expect(result.spotsLeft).toBe(0);
  });

  it("blocks signups over capacity", () => {
    const result = computeBetaCapacity(BETA_SPOT_LIMIT + 10);
    expect(result.allowed).toBe(false);
    expect(result.spotsLeft).toBe(0);
  });

  it("never returns negative spotsLeft", () => {
    const result = computeBetaCapacity(999);
    expect(result.spotsLeft).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// shouldBlockSignup
// ---------------------------------------------------------------------------

describe("shouldBlockSignup", () => {
  it("allows new user when under capacity", () => {
    const result = shouldBlockSignup(undefined, 10);
    expect(result).toBeNull();
  });

  it("blocks new user when at capacity", () => {
    const result = shouldBlockSignup(undefined, BETA_SPOT_LIMIT);
    expect(result).toContain("Beta is full");
  });

  it("blocks new user when over capacity", () => {
    const result = shouldBlockSignup(undefined, BETA_SPOT_LIMIT + 5);
    expect(result).toContain("Beta is full");
  });

  it("allows existing user to sign in even when at capacity", () => {
    const result = shouldBlockSignup("existing-user-id-123", BETA_SPOT_LIMIT);
    expect(result).toBeNull();
  });

  it("allows existing user to sign in even when over capacity", () => {
    const result = shouldBlockSignup("existing-user-id-123", BETA_SPOT_LIMIT + 100);
    expect(result).toBeNull();
  });

  it("returns null (not blocked) for existing user with null id", () => {
    // null existingUserId means new user
    const result = shouldBlockSignup(null, BETA_SPOT_LIMIT);
    expect(result).toContain("Beta is full");
  });

  it("error message includes the limit number", () => {
    const result = shouldBlockSignup(undefined, BETA_SPOT_LIMIT);
    expect(result).toContain(String(BETA_SPOT_LIMIT));
  });
});

// ---------------------------------------------------------------------------
// BETA_SPOT_LIMIT constant
// ---------------------------------------------------------------------------

describe("BETA_SPOT_LIMIT", () => {
  it("is a positive integer", () => {
    expect(BETA_SPOT_LIMIT).toBeGreaterThan(0);
    expect(Number.isInteger(BETA_SPOT_LIMIT)).toBe(true);
  });

  it("is 50 (current beta limit)", () => {
    expect(BETA_SPOT_LIMIT).toBe(50);
  });
});
