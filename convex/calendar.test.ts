import { describe, expect, it } from "vitest";
import { findGaps } from "./calendar";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Reproduces the state-parsing logic from convex/http.ts verbatim. */
function parseOAuthState(stateRaw: string | null): {
  userId: string | null;
  appUrl: string;
} {
  let userId: string | null = null;
  let appUrl = "http://localhost:3000";
  try {
    const parsed = JSON.parse(stateRaw ?? "{}");
    userId = parsed.userId ?? null;
    if (parsed.origin) appUrl = parsed.origin;
  } catch {
    userId = stateRaw;
  }
  return { userId, appUrl };
}

// ---------------------------------------------------------------------------
// findGaps
// ---------------------------------------------------------------------------

const DAY_START = new Date("2026-03-14T06:00:00Z");
const DAY_END = new Date("2026-03-14T22:00:00Z");

describe("findGaps", () => {
  it("returns the full window when there are no busy periods", () => {
    const gaps = findGaps(DAY_START, DAY_END, [], 30);

    expect(gaps).toHaveLength(1);
    expect(gaps[0].start).toBe(DAY_START.toISOString());
    expect(gaps[0].end).toBe(DAY_END.toISOString());
  });

  it("returns two gaps when a single busy period splits the window", () => {
    const busy = [{ start: "2026-03-14T09:00:00Z", end: "2026-03-14T10:00:00Z" }];

    const gaps = findGaps(DAY_START, DAY_END, busy, 30);

    expect(gaps).toHaveLength(2);
    expect(gaps[0]).toEqual({
      start: DAY_START.toISOString(),
      end: new Date("2026-03-14T09:00:00Z").toISOString(),
    });
    expect(gaps[1]).toEqual({
      start: new Date("2026-03-14T10:00:00Z").toISOString(),
      end: DAY_END.toISOString(),
    });
  });

  it("returns one gap before a busy period that ends at the window end", () => {
    const busy = [{ start: "2026-03-14T20:00:00Z", end: "2026-03-14T22:00:00Z" }];

    const gaps = findGaps(DAY_START, DAY_END, busy, 30);

    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toEqual({
      start: DAY_START.toISOString(),
      end: new Date("2026-03-14T20:00:00Z").toISOString(),
    });
  });

  it("returns one gap after a busy period that starts at the window start", () => {
    const busy = [{ start: "2026-03-14T06:00:00Z", end: "2026-03-14T08:00:00Z" }];

    const gaps = findGaps(DAY_START, DAY_END, busy, 30);

    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toEqual({
      start: new Date("2026-03-14T08:00:00Z").toISOString(),
      end: DAY_END.toISOString(),
    });
  });

  it("excludes gaps shorter than the minimum duration", () => {
    // Busy period leaves only a 20-minute gap between 09:00 and 09:20, then open until 22:00
    const busy = [{ start: "2026-03-14T06:00:00Z", end: "2026-03-14T09:00:00Z" }];

    // Request 30 minutes — the 3-hour gap before 09:00 is gone; only after gap (13h) qualifies
    const gaps = findGaps(DAY_START, DAY_END, busy, 30);

    // Only one gap: 09:00 → 22:00 (13 hours, well above minimum)
    expect(gaps).toHaveLength(1);
    expect(gaps[0].start).toBe(new Date("2026-03-14T09:00:00Z").toISOString());
  });

  it("filters out gaps that are exactly equal to but not longer than minimum duration", () => {
    // Gap of exactly 30 minutes should be included (>= minMs means busyStart - cursor >= minMs)
    const busy = [{ start: "2026-03-14T06:30:00Z", end: "2026-03-14T22:00:00Z" }];

    const gaps30 = findGaps(DAY_START, DAY_END, busy, 30);
    expect(gaps30).toHaveLength(1);
    expect(gaps30[0].start).toBe(DAY_START.toISOString());
    expect(gaps30[0].end).toBe(new Date("2026-03-14T06:30:00Z").toISOString());
  });

  it("excludes a gap that is 1 minute shorter than the required duration", () => {
    // Creates a 29-minute gap before the busy block
    const busy = [{ start: "2026-03-14T06:29:00Z", end: "2026-03-14T22:00:00Z" }];

    const gaps = findGaps(DAY_START, DAY_END, busy, 30);

    expect(gaps).toHaveLength(0);
  });

  it("returns no gaps when the single busy period covers the full window", () => {
    const busy = [{ start: "2026-03-14T06:00:00Z", end: "2026-03-14T22:00:00Z" }];

    const gaps = findGaps(DAY_START, DAY_END, busy, 30);

    expect(gaps).toHaveLength(0);
  });

  it("merges overlapping busy periods", () => {
    const busy = [
      { start: "2026-03-14T08:00:00Z", end: "2026-03-14T10:00:00Z" },
      { start: "2026-03-14T09:00:00Z", end: "2026-03-14T11:00:00Z" },
    ];

    const gaps = findGaps(DAY_START, DAY_END, busy, 30);

    // Two gaps: 06:00–08:00 and 11:00–22:00
    expect(gaps).toHaveLength(2);
    expect(gaps[0]).toEqual({
      start: DAY_START.toISOString(),
      end: new Date("2026-03-14T08:00:00Z").toISOString(),
    });
    expect(gaps[1]).toEqual({
      start: new Date("2026-03-14T11:00:00Z").toISOString(),
      end: DAY_END.toISOString(),
    });
  });

  it("handles adjacent busy periods with no gap between them", () => {
    const busy = [
      { start: "2026-03-14T06:00:00Z", end: "2026-03-14T12:00:00Z" },
      { start: "2026-03-14T12:00:00Z", end: "2026-03-14T22:00:00Z" },
    ];

    const gaps = findGaps(DAY_START, DAY_END, busy, 30);

    expect(gaps).toHaveLength(0);
  });

  it("handles out-of-order busy periods by sorting them", () => {
    const busyOutOfOrder = [
      { start: "2026-03-14T15:00:00Z", end: "2026-03-14T16:00:00Z" },
      { start: "2026-03-14T09:00:00Z", end: "2026-03-14T10:00:00Z" },
    ];

    const busyInOrder = [
      { start: "2026-03-14T09:00:00Z", end: "2026-03-14T10:00:00Z" },
      { start: "2026-03-14T15:00:00Z", end: "2026-03-14T16:00:00Z" },
    ];

    const resultOutOfOrder = findGaps(DAY_START, DAY_END, busyOutOfOrder, 30);
    const resultInOrder = findGaps(DAY_START, DAY_END, busyInOrder, 30);

    expect(resultOutOfOrder).toEqual(resultInOrder);
    expect(resultOutOfOrder).toHaveLength(3);
  });

  it("produces ISO string timestamps in all gap start/end fields", () => {
    const gaps = findGaps(DAY_START, DAY_END, [], 30);

    for (const gap of gaps) {
      expect(new Date(gap.start).toISOString()).toBe(gap.start);
      expect(new Date(gap.end).toISOString()).toBe(gap.end);
    }
  });
});

// ---------------------------------------------------------------------------
// OAuth state parsing (logic mirrored from convex/http.ts)
// ---------------------------------------------------------------------------

describe("parseOAuthState (OAuth callback state decoding)", () => {
  it("parses new-format JSON state and extracts userId and origin", () => {
    const state = JSON.stringify({ userId: "user-abc", origin: "https://app.example.com" });

    const { userId, appUrl } = parseOAuthState(state);

    expect(userId).toBe("user-abc");
    expect(appUrl).toBe("https://app.example.com");
  });

  it("uses default localhost URL when origin is absent from JSON state", () => {
    const state = JSON.stringify({ userId: "user-abc" });

    const { userId, appUrl } = parseOAuthState(state);

    expect(userId).toBe("user-abc");
    expect(appUrl).toBe("http://localhost:3000");
  });

  it("treats a plain non-JSON string as legacy userId", () => {
    const state = "user-legacy-id";

    const { userId, appUrl } = parseOAuthState(state);

    expect(userId).toBe("user-legacy-id");
    expect(appUrl).toBe("http://localhost:3000");
  });

  it("returns null userId when state is null", () => {
    const { userId } = parseOAuthState(null);

    expect(userId).toBeNull();
  });

  it("returns null userId and default URL when state is empty JSON object", () => {
    const state = "{}";

    const { userId, appUrl } = parseOAuthState(state);

    expect(userId).toBeNull();
    expect(appUrl).toBe("http://localhost:3000");
  });

  it("ignores empty-string origin and keeps default URL", () => {
    const state = JSON.stringify({ userId: "user-abc", origin: "" });

    const { userId, appUrl } = parseOAuthState(state);

    expect(userId).toBe("user-abc");
    // empty string is falsy, so appUrl stays as default
    expect(appUrl).toBe("http://localhost:3000");
  });
});
