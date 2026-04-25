import { describe, expect, test } from "vitest";
import { CACHE_TTLS } from "./cache";
import { isoDateUtc, shouldSkipBackgroundSync } from "./historySyncPreflight";

const NOW = Date.UTC(2026, 3, 25, 12, 0, 0);
const TODAY = "2026-04-25";
const YESTERDAY = "2026-04-24";

describe("shouldSkipBackgroundSync", () => {
  test("does not skip when the cache entry is missing", () => {
    expect(
      shouldSkipBackgroundSync({
        now: NOW,
        workoutHistoryCacheFetchedAt: undefined,
        lastSyncedActivityDate: TODAY,
        todayIso: TODAY,
      }),
    ).toBe(false);
  });

  test("does not skip when the activity watermark is missing", () => {
    expect(
      shouldSkipBackgroundSync({
        now: NOW,
        workoutHistoryCacheFetchedAt: NOW - 5 * 60 * 1000,
        lastSyncedActivityDate: undefined,
        todayIso: TODAY,
      }),
    ).toBe(false);
  });

  test("does not skip when the cache is older than its TTL", () => {
    expect(
      shouldSkipBackgroundSync({
        now: NOW,
        workoutHistoryCacheFetchedAt: NOW - CACHE_TTLS.workoutHistory - 1,
        lastSyncedActivityDate: TODAY,
        todayIso: TODAY,
      }),
    ).toBe(false);
  });

  test("does not skip when the cache fetchedAt is in the future", () => {
    expect(
      shouldSkipBackgroundSync({
        now: NOW,
        workoutHistoryCacheFetchedAt: NOW + 60 * 1000,
        lastSyncedActivityDate: TODAY,
        todayIso: TODAY,
      }),
    ).toBe(false);
  });

  test("skips when the cache is fresh and the watermark is today", () => {
    expect(
      shouldSkipBackgroundSync({
        now: NOW,
        workoutHistoryCacheFetchedAt: NOW - 2 * 60 * 1000,
        lastSyncedActivityDate: TODAY,
        todayIso: TODAY,
      }),
    ).toBe(true);
  });

  test("skips when the cache is fresh and the watermark is yesterday", () => {
    expect(
      shouldSkipBackgroundSync({
        now: NOW,
        workoutHistoryCacheFetchedAt: NOW - 10 * 60 * 1000,
        lastSyncedActivityDate: YESTERDAY,
        todayIso: TODAY,
      }),
    ).toBe(true);
  });

  test("does not skip when the watermark is more than 48 hours old", () => {
    expect(
      shouldSkipBackgroundSync({
        now: NOW,
        workoutHistoryCacheFetchedAt: NOW - 60 * 1000,
        lastSyncedActivityDate: "2026-04-22",
        todayIso: TODAY,
      }),
    ).toBe(false);
  });

  test("does not skip when the watermark is malformed", () => {
    expect(
      shouldSkipBackgroundSync({
        now: NOW,
        workoutHistoryCacheFetchedAt: NOW - 60 * 1000,
        lastSyncedActivityDate: "not-a-date",
        todayIso: TODAY,
      }),
    ).toBe(false);
  });

  test("rejects watermarks with out-of-range months or days instead of normalizing", () => {
    for (const bad of ["2026-13-01", "2026-00-15", "2026-02-30", "2026-04-31", "2026-12-32"]) {
      expect(
        shouldSkipBackgroundSync({
          now: NOW,
          workoutHistoryCacheFetchedAt: NOW - 60 * 1000,
          lastSyncedActivityDate: bad,
          todayIso: TODAY,
        }),
      ).toBe(false);
    }
  });
});

describe("isoDateUtc", () => {
  test("formats a UTC midnight date", () => {
    expect(isoDateUtc(Date.UTC(2026, 0, 5, 0, 0, 0))).toBe("2026-01-05");
  });

  test("uses UTC even when local timezone offsets push into the next day", () => {
    expect(isoDateUtc(Date.UTC(2026, 11, 31, 23, 30, 0))).toBe("2026-12-31");
  });
});
