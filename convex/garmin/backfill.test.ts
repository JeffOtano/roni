import { describe, expect, it } from "vitest";
import { chunkWindow } from "./backfill";

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
