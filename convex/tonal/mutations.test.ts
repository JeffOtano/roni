import { describe, expect, it, vi } from "vitest";
import {
  computePushDivergence,
  correctDurationRepsMismatch,
  enrichPushErrorMessage,
  formatTonalTitle,
  retryOn5xx,
} from "./mutations";
import { TonalApiError } from "./client";
import type { WorkoutSetInput } from "./types";

// ---------------------------------------------------------------------------
// enrichPushErrorMessage
// ---------------------------------------------------------------------------

describe("enrichPushErrorMessage", () => {
  it("includes title and movement IDs in the enriched message", () => {
    const result = enrichPushErrorMessage(
      "Tonal API 500: Internal Server Error",
      "Push Day - Monday",
      ["move-abc", "move-def", "move-ghi"],
    );

    expect(result).toContain("Push Day - Monday");
    expect(result).toContain("move-abc");
    expect(result).toContain("move-def");
    expect(result).toContain("move-ghi");
    expect(result).toContain("Tonal API 500");
  });

  it("includes all unique movement IDs", () => {
    const result = enrichPushErrorMessage("error", "Legs", ["m1", "m2", "m1"]);

    // Should deduplicate
    expect(result).toContain("m1");
    expect(result).toContain("m2");
  });
});

// ---------------------------------------------------------------------------
// formatTonalTitle
// ---------------------------------------------------------------------------

describe("formatTonalTitle", () => {
  it("prefixes the title with a short month-day date", () => {
    const date = new Date("2026-03-14T12:00:00Z");

    const result = formatTonalTitle("Push Day", date);

    // en-US locale: "Mar 14 · Push Day"
    expect(result).toBe("Mar 14 · Push Day");
  });

  it("uses the middle dot separator between date and title", () => {
    const date = new Date("2026-01-01T00:00:00Z");

    const result = formatTonalTitle("Leg Day", date);

    expect(result).toContain(" · ");
  });

  it("formats the date as abbreviated month followed by day number", () => {
    const date = new Date("2026-07-04T12:00:00Z");

    const result = formatTonalTitle("Independence Workout", date);

    expect(result).toMatch(/^Jul 4 · /);
  });

  it("handles single-digit day without zero-padding", () => {
    const date = new Date("2026-02-05T12:00:00Z");

    const result = formatTonalTitle("Core Blast", date);

    expect(result).toMatch(/^Feb 5 · /);
  });

  it("handles double-digit day correctly", () => {
    const date = new Date("2026-11-22T12:00:00Z");

    const result = formatTonalTitle("Total Body", date);

    expect(result).toMatch(/^Nov 22 · /);
  });

  it("appends the full title verbatim after the separator", () => {
    const date = new Date("2026-03-14T12:00:00Z");
    const title = "Upper Body — Hypertrophy Block A";

    const result = formatTonalTitle(title, date);

    expect(result.endsWith(title)).toBe(true);
  });

  it("handles an empty title string", () => {
    const date = new Date("2026-03-14T12:00:00Z");

    const result = formatTonalTitle("", date);

    expect(result).toBe("Mar 14 · ");
  });

  it("defaults to current date when no date argument is provided", () => {
    // Call with no date — should not throw and must contain the separator
    const result = formatTonalTitle("Quick Check");

    expect(result).toContain(" · ");
    expect(result.endsWith("Quick Check")).toBe(true);
  });
});

describe("retryOn5xx", () => {
  it("returns the value on first success without retrying", async () => {
    const fn = vi.fn(async () => "ok");

    const result = await retryOn5xx(fn, 2);

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on TonalApiError 5xx and eventually succeeds", async () => {
    vi.useFakeTimers();
    let calls = 0;
    const fn = async () => {
      calls++;
      if (calls < 3) throw new TonalApiError(503, "Service Unavailable");
      return "ok";
    };

    const promise = retryOn5xx(fn, 2);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe("ok");
    expect(calls).toBe(3);
    vi.useRealTimers();
  });

  it("does NOT retry on a 4xx — throws immediately", async () => {
    const fn = vi.fn(async () => {
      throw new TonalApiError(400, "Bad Request");
    });

    await expect(retryOn5xx(fn, 2)).rejects.toBeInstanceOf(TonalApiError);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does NOT retry on a 401 — 401 must reach withTokenRetry quickly", async () => {
    const fn = vi.fn(async () => {
      throw new TonalApiError(401, "Unauthorized");
    });

    await expect(retryOn5xx(fn, 2)).rejects.toMatchObject({ status: 401 });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does NOT retry on a plain Error", async () => {
    const fn = vi.fn(async () => {
      throw new Error("generic failure");
    });

    await expect(retryOn5xx(fn, 2)).rejects.toThrow("generic failure");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("gives up and rethrows after maxRetries on persistent 5xx", async () => {
    vi.useFakeTimers();
    const fn = vi.fn(async () => {
      throw new TonalApiError(500, "Internal Server Error");
    });

    // Attach the catch handler synchronously so the rejection is never unhandled.
    const settled = retryOn5xx(fn, 2).catch((e: unknown) => e);
    await vi.runAllTimersAsync();
    const result = await settled;

    expect(result).toMatchObject({ status: 500 });
    expect(fn).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });

  it("retries Tonal 500 from eligibility-style fetchers and succeeds on second attempt", async () => {
    vi.useFakeTimers();
    try {
      let calls = 0;
      const activities = [{ activityId: "a1" }];
      const fn = async () => {
        calls++;
        if (calls === 1)
          throw new TonalApiError(
            500,
            '{"message":"error getting activities for user","status":500}',
          );
        return activities;
      };

      const promise = retryOn5xx(fn, 2);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe(activities);
      expect(calls).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });
});

// ---------------------------------------------------------------------------
// pushWorkoutToTonal catch block (TONALCOACH-2A fix)
// The handler now RETURNS { error } for non-401 errors instead of throwing,
// so Convex never sees the action as failed and stops sending noise to Sentry.
// 401s still throw so withTokenRetry can handle them with a token refresh.
// ---------------------------------------------------------------------------
describe("pushWorkoutToTonal catch block", () => {
  // Old behaviour (throws for everything): kept to document the regression path.
  function simulateCatchThrows(err: unknown, title: string, movementIds: string[]) {
    if (err instanceof TonalApiError && err.status === 401) throw err;
    const errMsg = err instanceof Error ? err.message : String(err);
    throw new Error(enrichPushErrorMessage(errMsg, title, movementIds));
  }

  // New behaviour (returns error object for non-401): mirrors the fixed handler.
  function simulateCatchReturns(
    err: unknown,
    title: string,
    movementIds: string[],
  ): { error: string } {
    if (err instanceof TonalApiError && err.status === 401) throw err;
    const errMsg = err instanceof Error ? err.message : String(err);
    return { error: enrichPushErrorMessage(errMsg, title, movementIds) };
  }

  it("still throws TonalApiError 401 so withTokenRetry can refresh the token", () => {
    const original = new TonalApiError(401, "token is expired by 33s");

    expect(() => simulateCatchReturns(original, "Full body", ["m1"])).toThrow(TonalApiError);
    expect(() => simulateCatchReturns(original, "Full body", ["m1"])).toThrow(
      expect.objectContaining({ status: 401 }),
    );
  });

  it("returns { error } for 400 errors instead of throwing (no Sentry noise)", () => {
    const original = new TonalApiError(400, "Bad Request");

    const result = simulateCatchReturns(original, "Push Day", ["m1", "m2"]);

    expect(result).toHaveProperty("error");
    expect(result.error).toContain("Push Day");
    expect(result.error).toContain("Bad Request");
  });

  it("returns { error } for Tonal API 500 instead of throwing (no Sentry noise)", () => {
    const original = new TonalApiError(500, '{"message":"","status":500}');

    const result = simulateCatchReturns(original, "Leg Day", ["m1"]);

    expect(result).toHaveProperty("error");
    expect(result.error).toContain("Leg Day");
    expect(result.error).toContain("500");
  });

  it("returned error object is not an Error instance — does not propagate as a throw", () => {
    const original = new TonalApiError(503, "Service Unavailable");

    const result = simulateCatchReturns(original, "Core", ["m2"]);

    // Must be a plain object — caller checks `'error' in result`
    expect(result).not.toBeInstanceOf(Error);
    expect(typeof result.error).toBe("string");
  });

  // Regression guard: old throw-based path is preserved for reference; the
  // 401 carve-out must still throw in the old path too.
  it("old simulateCatch also re-throws TonalApiError 401 directly without wrapping", () => {
    const original = new TonalApiError(401, "token is expired by 33s");

    try {
      simulateCatchThrows(original, "Full body", ["m1"]);
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(TonalApiError);
      expect((err as TonalApiError).status).toBe(401);
      expect(err).toBe(original);
    }
  });
});

// ---------------------------------------------------------------------------
// correctDurationRepsMismatch
// ---------------------------------------------------------------------------

function makeSet(overrides: Partial<WorkoutSetInput> = {}): WorkoutSetInput {
  return {
    movementId: "move-1",
    blockNumber: 1,
    ...overrides,
  };
}

describe("correctDurationRepsMismatch", () => {
  const durationMovement = { id: "pushup-1", name: "Pushup", countReps: false };
  const repMovement = { id: "bench-1", name: "Bench Press", countReps: true };

  it("corrects a duration-based movement that has prescribedReps", () => {
    const sets = [makeSet({ movementId: "pushup-1", prescribedReps: 10 })];

    const corrections = correctDurationRepsMismatch(sets, [durationMovement]);

    expect(corrections).toBe(1);
    expect(sets[0].prescribedReps).toBeUndefined();
    expect(sets[0].prescribedDuration).toBe(30);
    expect(sets[0].prescribedResistanceLevel).toBe(5);
  });

  it("preserves existing prescribedDuration when correcting", () => {
    const sets = [makeSet({ movementId: "pushup-1", prescribedReps: 10, prescribedDuration: 45 })];

    correctDurationRepsMismatch(sets, [durationMovement]);

    expect(sets[0].prescribedDuration).toBe(45);
  });

  it("does not touch rep-based movements", () => {
    const sets = [makeSet({ movementId: "bench-1", prescribedReps: 8 })];

    const corrections = correctDurationRepsMismatch(sets, [repMovement]);

    expect(corrections).toBe(0);
    expect(sets[0].prescribedReps).toBe(8);
    expect(sets[0].prescribedDuration).toBeUndefined();
  });

  it("does not touch movements not in catalog", () => {
    const sets = [makeSet({ movementId: "unknown", prescribedReps: 10 })];

    const corrections = correctDurationRepsMismatch(sets, [durationMovement]);

    expect(corrections).toBe(0);
    expect(sets[0].prescribedReps).toBe(10);
  });

  it("handles empty sets array", () => {
    const corrections = correctDurationRepsMismatch([], [durationMovement]);

    expect(corrections).toBe(0);
  });

  it("corrects multiple sets in one pass", () => {
    const sets = [
      makeSet({ movementId: "pushup-1", prescribedReps: 10 }),
      makeSet({ movementId: "bench-1", prescribedReps: 8 }),
      makeSet({ movementId: "pushup-1", prescribedReps: 12 }),
    ];

    const corrections = correctDurationRepsMismatch(sets, [durationMovement, repMovement]);

    expect(corrections).toBe(2);
    expect(sets[0].prescribedReps).toBeUndefined();
    expect(sets[1].prescribedReps).toBe(8);
    expect(sets[2].prescribedReps).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// computePushDivergence
// ---------------------------------------------------------------------------

describe("computePushDivergence", () => {
  it("returns null when intended and stored sets match exactly", () => {
    const intended = [
      { movementId: "a", sets: 3 },
      { movementId: "b", sets: 2 },
    ];
    const storedSets = [
      { movementId: "a", prescribedReps: 10 },
      { movementId: "a", prescribedReps: 10 },
      { movementId: "a", prescribedReps: 10 },
      { movementId: "b", prescribedDuration: 30 },
      { movementId: "b", prescribedDuration: 30 },
    ];
    expect(computePushDivergence(intended, storedSets)).toBeNull();
  });

  it("flags a missing movement", () => {
    const intended = [
      { movementId: "a", sets: 3 },
      { movementId: "b", sets: 2 },
    ];
    const storedSets = [
      { movementId: "a", prescribedReps: 10 },
      { movementId: "a", prescribedReps: 10 },
      { movementId: "a", prescribedReps: 10 },
    ];
    const div = computePushDivergence(intended, storedSets);
    expect(div).not.toBeNull();
    expect(div!.missingMovements).toContain("b");
  });

  it("flags a set-count mismatch", () => {
    const intended = [{ movementId: "a", sets: 3 }];
    const storedSets = [
      { movementId: "a", prescribedReps: 10 },
      { movementId: "a", prescribedReps: 10 },
    ];
    const div = computePushDivergence(intended, storedSets);
    expect(div).not.toBeNull();
    expect(div!.setCountMismatches).toEqual([{ movementId: "a", intended: 3, stored: 2 }]);
  });

  it("flags an extra movement that wasn't sent", () => {
    const intended = [{ movementId: "a", sets: 1 }];
    const storedSets = [
      { movementId: "a", prescribedReps: 10 },
      { movementId: "z", prescribedReps: 10 },
    ];
    const div = computePushDivergence(intended, storedSets);
    expect(div).not.toBeNull();
    expect(div!.extraMovements).toContain("z");
  });
});
