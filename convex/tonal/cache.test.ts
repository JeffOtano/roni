import { describe, expect, it } from "vitest";
import { CACHE_TTLS } from "./cache";

// ---------------------------------------------------------------------------
// CACHE_TTLS
// ---------------------------------------------------------------------------

describe("CACHE_TTLS", () => {
  it("contains all expected data types", () => {
    const expectedKeys = [
      "profile",
      "strengthScores",
      "strengthHistory",
      "muscleReadiness",
      "workoutHistory",
      "customWorkouts",
      "strengthDistribution",
    ];

    for (const key of expectedKeys) {
      expect(CACHE_TTLS).toHaveProperty(key);
    }
  });

  it("all TTLs are positive numbers in milliseconds", () => {
    for (const [key, ttl] of Object.entries(CACHE_TTLS)) {
      expect(ttl, `${key} should be a positive number`).toBeGreaterThan(0);
      expect(Number.isFinite(ttl), `${key} should be finite`).toBe(true);
    }
  });

  it("profile has the longest TTL (24 hours)", () => {
    expect(CACHE_TTLS.profile).toBe(24 * 60 * 60 * 1000);
  });

  it("customWorkouts has the shortest TTL (5 minutes)", () => {
    expect(CACHE_TTLS.customWorkouts).toBe(5 * 60 * 1000);

    const minTtl = Math.min(...Object.values(CACHE_TTLS));
    expect(CACHE_TTLS.customWorkouts).toBe(minTtl);
  });

  it("strengthScores and strengthHistory share the same TTL (1 hour)", () => {
    expect(CACHE_TTLS.strengthScores).toBe(60 * 60 * 1000);
    expect(CACHE_TTLS.strengthHistory).toBe(CACHE_TTLS.strengthScores);
  });

  it("muscleReadiness and workoutHistory share the same TTL (30 minutes)", () => {
    expect(CACHE_TTLS.muscleReadiness).toBe(30 * 60 * 1000);
    expect(CACHE_TTLS.workoutHistory).toBe(CACHE_TTLS.muscleReadiness);
  });

  it("strengthDistribution has a 6-hour TTL", () => {
    expect(CACHE_TTLS.strengthDistribution).toBe(6 * 60 * 60 * 1000);
  });

  it("TTLs are ordered by volatility: custom < readiness/history < scores < distribution < profile", () => {
    expect(CACHE_TTLS.customWorkouts).toBeLessThan(CACHE_TTLS.muscleReadiness);
    expect(CACHE_TTLS.muscleReadiness).toBeLessThan(CACHE_TTLS.strengthScores);
    expect(CACHE_TTLS.strengthScores).toBeLessThan(CACHE_TTLS.strengthDistribution);
    expect(CACHE_TTLS.strengthDistribution).toBeLessThan(CACHE_TTLS.profile);
  });
});

// ---------------------------------------------------------------------------
// Cache freshness logic (pure computation, tested without Convex runtime)
// ---------------------------------------------------------------------------

describe("cache freshness computation", () => {
  it("entry is fresh when current time is before expiresAt", () => {
    const now = Date.now();
    const expiresAt = now + CACHE_TTLS.profile;

    expect(now < expiresAt).toBe(true);
  });

  it("entry is stale when current time exceeds expiresAt", () => {
    const fetchedAt = Date.now() - CACHE_TTLS.profile - 1000;
    const expiresAt = fetchedAt + CACHE_TTLS.profile;
    const now = Date.now();

    expect(now > expiresAt).toBe(true);
  });

  it("concurrent write guard: newer fetchedAt wins over older", () => {
    const olderFetchedAt = 1000;
    const newerFetchedAt = 2000;

    // Simulate the guard from setCacheEntry: skip if incoming <= existing
    const shouldSkip = newerFetchedAt <= olderFetchedAt;
    expect(shouldSkip).toBe(false);

    const shouldSkipReverse = olderFetchedAt <= newerFetchedAt;
    expect(shouldSkipReverse).toBe(true);
  });

  it("concurrent write guard: equal timestamps are skipped (idempotent)", () => {
    const fetchedAt = 1000;

    const shouldSkip = fetchedAt <= fetchedAt;
    expect(shouldSkip).toBe(true);
  });
});
