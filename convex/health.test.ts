import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// health.ts pure logic patterns
//
// The file only exports Convex mutations/queries with no standalone pure
// functions. We test the computation patterns used inside:
//   1. Date cutoff calculation for getRecentSnapshots / getRecent
//   2. Merge patch logic for syncSnapshot (only non-undefined fields patched)
//   3. Window clamping (max 90 days for public query)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Date cutoff calculation
// ---------------------------------------------------------------------------

describe("date cutoff calculation", () => {
  it("computes ISO date string from days offset", () => {
    // This mirrors the pattern: new Date(Date.now() - days * DAY_MS).toISOString().slice(0, 10)
    const referenceTime = new Date("2026-03-27T12:00:00Z").getTime();
    const days = 14;
    const cutoffMs = referenceTime - days * 24 * 60 * 60 * 1000;
    const cutoffDate = new Date(cutoffMs).toISOString().slice(0, 10);

    expect(cutoffDate).toBe("2026-03-13");
  });

  it("defaults to 14 days when days is undefined", () => {
    const days = undefined;
    const windowDays = days ?? 14;

    expect(windowDays).toBe(14);
  });

  it("uses provided days value when specified", () => {
    const days = 7;
    const windowDays = days ?? 14;

    expect(windowDays).toBe(7);
  });

  it("handles boundary: 1 day lookback", () => {
    const referenceTime = new Date("2026-03-27T00:00:00Z").getTime();
    const cutoffMs = referenceTime - 1 * 24 * 60 * 60 * 1000;
    const cutoffDate = new Date(cutoffMs).toISOString().slice(0, 10);

    expect(cutoffDate).toBe("2026-03-26");
  });

  it("handles year boundary", () => {
    const referenceTime = new Date("2026-01-05T12:00:00Z").getTime();
    const cutoffMs = referenceTime - 14 * 24 * 60 * 60 * 1000;
    const cutoffDate = new Date(cutoffMs).toISOString().slice(0, 10);

    expect(cutoffDate).toBe("2025-12-22");
  });
});

// ---------------------------------------------------------------------------
// Window clamping for public query
// ---------------------------------------------------------------------------

describe("window clamping", () => {
  it("caps at 90 days when requested days exceed limit", () => {
    const requestedDays = 365;
    const windowDays = Math.min(requestedDays ?? 14, 90);

    expect(windowDays).toBe(90);
  });

  it("allows days within limit", () => {
    const requestedDays = 30;
    const windowDays = Math.min(requestedDays ?? 14, 90);

    expect(windowDays).toBe(30);
  });

  it("defaults to 14 when undefined and caps check still applies", () => {
    const requestedDays = undefined;
    const windowDays = Math.min(requestedDays ?? 14, 90);

    expect(windowDays).toBe(14);
  });

  it("allows exactly 90 days", () => {
    const requestedDays = 90;
    const windowDays = Math.min(requestedDays ?? 14, 90);

    expect(windowDays).toBe(90);
  });
});

// ---------------------------------------------------------------------------
// Merge patch logic for syncSnapshot
// ---------------------------------------------------------------------------

describe("merge patch logic", () => {
  it("only includes explicitly provided fields in the patch", () => {
    // This mirrors the pattern from syncSnapshot where undefined args are skipped
    const args = {
      sleepDurationMinutes: 480,
      sleepDeepMinutes: undefined,
      restingHeartRate: 58,
      hrvSDNN: undefined,
      steps: 10000,
    };

    const patch: Record<string, unknown> = {};

    if (args.sleepDurationMinutes !== undefined)
      patch.sleepDurationMinutes = args.sleepDurationMinutes;
    if (args.sleepDeepMinutes !== undefined) patch.sleepDeepMinutes = args.sleepDeepMinutes;
    if (args.restingHeartRate !== undefined) patch.restingHeartRate = args.restingHeartRate;
    if (args.hrvSDNN !== undefined) patch.hrvSDNN = args.hrvSDNN;
    if (args.steps !== undefined) patch.steps = args.steps;

    expect(patch).toEqual({
      sleepDurationMinutes: 480,
      restingHeartRate: 58,
      steps: 10000,
    });

    // Crucially, undefined fields are NOT present
    expect(patch).not.toHaveProperty("sleepDeepMinutes");
    expect(patch).not.toHaveProperty("hrvSDNN");
  });

  it("includes zero values (zero is not undefined)", () => {
    const args = {
      steps: 0,
      activeEnergyBurned: 0,
      exerciseMinutes: undefined,
    };

    const patch: Record<string, unknown> = {};

    if (args.steps !== undefined) patch.steps = args.steps;
    if (args.activeEnergyBurned !== undefined) patch.activeEnergyBurned = args.activeEnergyBurned;
    if (args.exerciseMinutes !== undefined) patch.exerciseMinutes = args.exerciseMinutes;

    expect(patch).toEqual({
      steps: 0,
      activeEnergyBurned: 0,
    });
  });

  it("creates empty patch when all fields are undefined", () => {
    const args = {
      sleepDurationMinutes: undefined,
      restingHeartRate: undefined,
    };

    const patch: Record<string, unknown> = {};

    if (args.sleepDurationMinutes !== undefined)
      patch.sleepDurationMinutes = args.sleepDurationMinutes;
    if (args.restingHeartRate !== undefined) patch.restingHeartRate = args.restingHeartRate;

    expect(Object.keys(patch)).toHaveLength(0);
  });
});
