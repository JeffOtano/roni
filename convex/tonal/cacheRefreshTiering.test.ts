import { describe, expect, test } from "vitest";
import {
  classifyTier,
  computeNextSyncAt,
  isEligibleForRefresh,
  TIER_INTERVAL_SLACK_MS,
  TIER_INTERVALS_MS,
  TIER_THRESHOLDS_MS,
} from "./cacheRefreshTiering";

const NOW = 1_750_000_000_000;
const MIN = 60 * 1000;
const HOUR = 60 * MIN;

describe("classifyTier", () => {
  test('returns "skip" when appLastActiveAt is undefined', () => {
    expect(classifyTier(NOW, undefined)).toBe("skip");
  });

  test('returns "active" for activity within the last 4 hours', () => {
    expect(classifyTier(NOW, NOW - 0)).toBe("active");
    expect(classifyTier(NOW, NOW - 3 * HOUR)).toBe("active");
    expect(classifyTier(NOW, NOW - (TIER_THRESHOLDS_MS.active - 1))).toBe("active");
  });

  test('returns "active" when appLastActiveAt is in the future (clock skew)', () => {
    expect(classifyTier(NOW, NOW + 5 * MIN)).toBe("active");
  });

  test('returns "recent" between 4 and 24 hours of inactivity', () => {
    expect(classifyTier(NOW, NOW - TIER_THRESHOLDS_MS.active)).toBe("recent");
    expect(classifyTier(NOW, NOW - 12 * HOUR)).toBe("recent");
    expect(classifyTier(NOW, NOW - (TIER_THRESHOLDS_MS.recent - 1))).toBe("recent");
  });

  test('returns "lapsing" between 24 and 72 hours of inactivity', () => {
    expect(classifyTier(NOW, NOW - TIER_THRESHOLDS_MS.recent)).toBe("lapsing");
    expect(classifyTier(NOW, NOW - 48 * HOUR)).toBe("lapsing");
    expect(classifyTier(NOW, NOW - (TIER_THRESHOLDS_MS.lapsing - 1))).toBe("lapsing");
  });

  test('returns "skip" beyond 72 hours of inactivity', () => {
    expect(classifyTier(NOW, NOW - TIER_THRESHOLDS_MS.lapsing)).toBe("skip");
    expect(classifyTier(NOW, NOW - 7 * 24 * HOUR)).toBe("skip");
  });
});

describe("isEligibleForRefresh", () => {
  test("rejects users outside the 72-hour cohort", () => {
    expect(isEligibleForRefresh(NOW, undefined, undefined)).toBe(false);
    expect(isEligibleForRefresh(NOW, NOW - 4 * 24 * HOUR, undefined)).toBe(false);
  });

  test("admits never-synced users in any active tier", () => {
    expect(isEligibleForRefresh(NOW, NOW - 1 * HOUR, undefined)).toBe(true);
    expect(isEligibleForRefresh(NOW, NOW - 12 * HOUR, undefined)).toBe(true);
    expect(isEligibleForRefresh(NOW, NOW - 48 * HOUR, undefined)).toBe(true);
  });

  test("active-tier users sync at the 30-minute cadence with cron slack", () => {
    const appActive = NOW - 30 * MIN;
    expect(isEligibleForRefresh(NOW, appActive, NOW - (TIER_INTERVALS_MS.active - 30 * 1000))).toBe(
      true,
    );
    expect(isEligibleForRefresh(NOW, appActive, NOW - 5 * MIN)).toBe(false);
  });

  test("recent-tier users wait an hour between syncs", () => {
    const appActive = NOW - 6 * HOUR;
    expect(isEligibleForRefresh(NOW, appActive, NOW - 30 * MIN)).toBe(false);
    expect(isEligibleForRefresh(NOW, appActive, NOW - (HOUR - 30 * 1000))).toBe(true);
    expect(isEligibleForRefresh(NOW, appActive, NOW - 90 * MIN)).toBe(true);
  });

  test("lapsing-tier users wait six hours between syncs", () => {
    const appActive = NOW - 36 * HOUR;
    expect(isEligibleForRefresh(NOW, appActive, NOW - 1 * HOUR)).toBe(false);
    expect(isEligibleForRefresh(NOW, appActive, NOW - 5 * HOUR)).toBe(false);
    expect(isEligibleForRefresh(NOW, appActive, NOW - 6 * HOUR)).toBe(true);
    expect(isEligibleForRefresh(NOW, appActive, NOW - 12 * HOUR)).toBe(true);
  });
});

describe("computeNextSyncAt", () => {
  test("returns undefined for users outside the 72h cohort", () => {
    expect(computeNextSyncAt(NOW, undefined, undefined)).toBeUndefined();
    expect(computeNextSyncAt(NOW, NOW - 4 * 24 * HOUR, NOW - HOUR)).toBeUndefined();
  });

  test("returns 0 for never-synced users so the index range query picks them up", () => {
    expect(computeNextSyncAt(NOW, NOW - 1 * HOUR, undefined)).toBe(0);
    expect(computeNextSyncAt(NOW, NOW - 36 * HOUR, undefined)).toBe(0);
  });

  test("matches isEligibleForRefresh: now >= nextSyncAt iff eligible", () => {
    const cases: Array<[number, number]> = [
      [NOW - 30 * MIN, NOW - 25 * MIN],
      [NOW - 6 * HOUR, NOW - HOUR],
      [NOW - 36 * HOUR, NOW - 5 * HOUR],
    ];
    for (const [appActive, lastSync] of cases) {
      const nextAt = computeNextSyncAt(NOW, appActive, lastSync);
      const eligible = isEligibleForRefresh(NOW, appActive, lastSync);
      if (nextAt === undefined) {
        expect(eligible).toBe(false);
        continue;
      }
      expect(NOW >= nextAt).toBe(eligible);
    }
  });

  test("recompute yields the canonical interval boundary minus slack", () => {
    const lastSync = NOW - 5 * MIN;
    const next = computeNextSyncAt(NOW, NOW - 30 * MIN, lastSync);
    expect(next).toBe(lastSync + TIER_INTERVALS_MS.active - TIER_INTERVAL_SLACK_MS);
  });
});
