import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Self-scheduling page logic — mirrors the runCheckInTriggerEvaluation handler
// ---------------------------------------------------------------------------

/**
 * Simulates the scheduling decision in runCheckInTriggerEvaluation.
 * Returns whether the action should schedule a continuation and with what cursor.
 */
function shouldScheduleContinuation(result: {
  isDone: boolean;
  continueCursor: string;
}): { schedule: false } | { schedule: true; nextCursor: string } {
  if (!result.isDone) {
    return { schedule: true, nextCursor: result.continueCursor };
  }
  return { schedule: false };
}

describe("runCheckInTriggerEvaluation self-scheduling", () => {
  it("schedules a continuation when the page is not done", () => {
    const result = shouldScheduleContinuation({
      isDone: false,
      continueCursor: "cursor-abc",
    });

    expect(result).toEqual({ schedule: true, nextCursor: "cursor-abc" });
  });

  it("does not schedule when isDone is true", () => {
    const result = shouldScheduleContinuation({
      isDone: true,
      continueCursor: "cursor-ignored",
    });

    expect(result).toEqual({ schedule: false });
  });

  it("passes the exact continueCursor from the page result", () => {
    const continueCursor = "unique-cursor-xyz-789";
    const result = shouldScheduleContinuation({ isDone: false, continueCursor });

    if (!result.schedule) throw new Error("Expected schedule");
    expect(result.nextCursor).toBe(continueCursor);
  });
});

// ---------------------------------------------------------------------------
// now arg propagation — the same `now` timestamp should be reused across pages
// so frequency-window comparisons remain consistent within one evaluation wave
// ---------------------------------------------------------------------------

describe("now propagation across pages", () => {
  function resolvePaginationNow(nowArg: number | undefined): number {
    return nowArg ?? Date.now();
  }

  it("uses the provided now arg when present", () => {
    const fixedNow = 1_700_000_000_000;
    expect(resolvePaginationNow(fixedNow)).toBe(fixedNow);
  });

  it("falls back to Date.now() when now arg is absent", () => {
    const before = Date.now();
    const result = resolvePaginationNow(undefined);
    const after = Date.now();
    expect(result).toBeGreaterThanOrEqual(before);
    expect(result).toBeLessThanOrEqual(after);
  });
});

// ---------------------------------------------------------------------------
// Batch-size logic — batches respect BATCH_SIZE and DELAY_MS boundaries
// ---------------------------------------------------------------------------

describe("batch boundary calculation", () => {
  const BATCH_SIZE = 5;

  function shouldDelayAfterBatch(i: number, pageLength: number): boolean {
    return i + BATCH_SIZE < pageLength;
  }

  it("delays after non-final batches", () => {
    expect(shouldDelayAfterBatch(0, 10)).toBe(true);
    expect(shouldDelayAfterBatch(5, 10)).toBe(false);
  });

  it("does not delay after the final batch", () => {
    expect(shouldDelayAfterBatch(0, 5)).toBe(false);
  });

  it("does not delay when page has exactly BATCH_SIZE users", () => {
    expect(shouldDelayAfterBatch(0, BATCH_SIZE)).toBe(false);
  });

  it("delays when page has more than one batch worth of users", () => {
    expect(shouldDelayAfterBatch(0, BATCH_SIZE + 1)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Analytics: only fire on last page
// ---------------------------------------------------------------------------

describe("analytics emission policy", () => {
  function shouldEmitAnalytics(isDone: boolean): boolean {
    return isDone;
  }

  it("emits analytics on the last page", () => {
    expect(shouldEmitAnalytics(true)).toBe(true);
  });

  it("does not emit analytics on intermediate pages", () => {
    expect(shouldEmitAnalytics(false)).toBe(false);
  });
});
