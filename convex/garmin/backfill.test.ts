import { afterEach, describe, expect, it, vi } from "vitest";
import {
  chunkWindow,
  parseRetryAfterMs,
  remainingBackfillSummaryTypesAfter,
  requestBackfillChunk,
} from "./backfill";

const SECONDS_PER_DAY = 86_400;

describe("chunkWindow", () => {
  it("returns a single chunk when the window is smaller than the max", () => {
    const start = 1_000_000;
    const end = start + 20 * SECONDS_PER_DAY;
    expect(chunkWindow(start, end, 30)).toEqual([{ start, end }]);
  });

  it("splits a 60-day window into two 30-day chunks", () => {
    const start = 1_000_000;
    const end = start + 60 * SECONDS_PER_DAY;
    const chunks = chunkWindow(start, end, 30);
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toEqual({ start, end: start + 30 * SECONDS_PER_DAY });
    expect(chunks[1]).toEqual({ start: start + 30 * SECONDS_PER_DAY, end });
  });

  it("splits a 75-day window into a 30+30+15 pattern", () => {
    const start = 1_000_000;
    const end = start + 75 * SECONDS_PER_DAY;
    const chunks = chunkWindow(start, end, 30);
    expect(chunks).toHaveLength(3);
    expect(chunks[2].end - chunks[2].start).toBe(15 * SECONDS_PER_DAY);
  });

  it("returns empty when end is not after start", () => {
    expect(chunkWindow(100, 100, 30)).toEqual([]);
    expect(chunkWindow(200, 100, 30)).toEqual([]);
  });

  it("never emits a chunk that exceeds the cap", () => {
    const start = 1_000_000;
    const end = start + 180 * SECONDS_PER_DAY;
    const chunks = chunkWindow(start, end, 30);
    for (const chunk of chunks) {
      expect(chunk.end - chunk.start).toBeLessThanOrEqual(30 * SECONDS_PER_DAY);
    }
  });
});

describe("parseRetryAfterMs", () => {
  it("parses numeric retry-after seconds", () => {
    expect(parseRetryAfterMs("75", Date.UTC(2026, 3, 26))).toBe(75_000);
  });

  it("parses retry-after HTTP dates relative to the provided clock", () => {
    const now = Date.parse("2026-04-26T01:00:00.000Z");

    expect(parseRetryAfterMs("Sun, 26 Apr 2026 01:02:00 GMT", now)).toBe(120_000);
  });

  it("returns zero for past retry-after HTTP dates", () => {
    const now = Date.parse("2026-04-26T01:00:00.000Z");

    expect(parseRetryAfterMs("Sun, 26 Apr 2026 00:59:00 GMT", now)).toBe(0);
  });

  it("returns null for missing or malformed retry-after values", () => {
    expect(parseRetryAfterMs(null, Date.now())).toBeNull();
    expect(parseRetryAfterMs("", Date.now())).toBeNull();
    expect(parseRetryAfterMs("not-a-date", Date.now())).toBeNull();
  });
});

describe("requestBackfillChunk", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns a synthetic failure status when the first fetch throws", async () => {
    const getOnce = vi.fn<() => Promise<Response>>().mockRejectedValueOnce(new Error("offline"));

    await expect(requestBackfillChunk(getOnce)).resolves.toEqual({ status: 599 });
    expect(getOnce).toHaveBeenCalledTimes(1);
  });

  it("returns a synthetic failure status when the retry fetch throws", async () => {
    vi.useFakeTimers();
    const getOnce = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockRejectedValueOnce(new Error("offline"));

    const result = requestBackfillChunk(getOnce);
    await vi.waitFor(() => expect(getOnce).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(5_000);
    await vi.waitFor(() => expect(getOnce).toHaveBeenCalledTimes(2));

    await expect(result).resolves.toEqual({ status: 599 });
  });
});

describe("remainingBackfillSummaryTypesAfter", () => {
  it("returns every deferred summary type after a core summary is rate-limited", () => {
    expect(remainingBackfillSummaryTypesAfter("dailies")).toEqual([
      "sleeps",
      "stressDetails",
      "hrv",
      "userMetrics",
      "pulseOx",
      "respiration",
      "skinTemp",
    ]);
  });

  it("returns every deferred summary type after sleeps is rate-limited", () => {
    expect(remainingBackfillSummaryTypesAfter("sleeps")).toEqual([
      "stressDetails",
      "hrv",
      "userMetrics",
      "pulseOx",
      "respiration",
      "skinTemp",
    ]);
  });
});
