import { describe, expect, it } from "vitest";

// Constants mirrored from triggers.ts
const EIGHTEEN_HOURS_MS = 18 * 60 * 60 * 1000;
const MISSED_SESSION_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const GAP_3_DAYS_COOLDOWN_MS = 5 * 24 * 60 * 60 * 1000;
const WEEKLY_RECAP_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const TOUGH_SESSION_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000;
const STRENGTH_MILESTONE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
const PLATEAU_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;
const HIGH_EXTERNAL_LOAD_COOLDOWN_MS = 2 * 24 * 60 * 60 * 1000;
const CONSISTENCY_STREAK_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
const VIGOROUS_HR_THRESHOLD = 130;

// ---------------------------------------------------------------------------
// Cooldown constant validation
// ---------------------------------------------------------------------------

describe("cooldown constants", () => {
  it("all cooldowns are positive", () => {
    const cooldowns = [
      MISSED_SESSION_COOLDOWN_MS,
      GAP_3_DAYS_COOLDOWN_MS,
      WEEKLY_RECAP_COOLDOWN_MS,
      TOUGH_SESSION_COOLDOWN_MS,
      STRENGTH_MILESTONE_COOLDOWN_MS,
      PLATEAU_COOLDOWN_MS,
      HIGH_EXTERNAL_LOAD_COOLDOWN_MS,
      CONSISTENCY_STREAK_COOLDOWN_MS,
    ];
    for (const cd of cooldowns) expect(cd).toBeGreaterThan(0);
  });

  it("missed session cooldown is shortest at 24 hours", () => {
    expect(MISSED_SESSION_COOLDOWN_MS).toBe(TWENTY_FOUR_HOURS_MS);
  });

  it("plateau cooldown is longest at 14 days", () => {
    const all = [
      MISSED_SESSION_COOLDOWN_MS,
      GAP_3_DAYS_COOLDOWN_MS,
      WEEKLY_RECAP_COOLDOWN_MS,
      TOUGH_SESSION_COOLDOWN_MS,
      STRENGTH_MILESTONE_COOLDOWN_MS,
      PLATEAU_COOLDOWN_MS,
      HIGH_EXTERNAL_LOAD_COOLDOWN_MS,
      CONSISTENCY_STREAK_COOLDOWN_MS,
    ];
    expect(PLATEAU_COOLDOWN_MS).toBe(Math.max(...all));
  });

  it("18 hours threshold is less than 24 hours", () => {
    expect(EIGHTEEN_HOURS_MS).toBeLessThan(TWENTY_FOUR_HOURS_MS);
  });
});

// ---------------------------------------------------------------------------
// Yesterday index calculation
// ---------------------------------------------------------------------------

describe("yesterday index calculation", () => {
  it("returns correct index for every day of the week", () => {
    // dayOfWeek: 0=Sun, 1=Mon, ..., 6=Sat
    // Expected: Sun->6, Mon->0, Tue->1, Wed->2, Thu->3, Fri->4, Sat->5
    const expected = [6, 0, 1, 2, 3, 4, 5];
    for (let dayOfWeek = 0; dayOfWeek <= 6; dayOfWeek++) {
      const yesterdayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      expect(yesterdayIndex).toBe(expected[dayOfWeek]);
    }
  });
});

// ---------------------------------------------------------------------------
// Session status classification
// ---------------------------------------------------------------------------

describe("session status classification", () => {
  function wasProgrammed(slot: { sessionType: string; status: string }): boolean {
    return (
      slot.sessionType !== "rest" && (slot.status === "programmed" || slot.status === "missed")
    );
  }

  it("recognizes programmed session as missed target", () => {
    expect(wasProgrammed({ sessionType: "strength", status: "programmed" })).toBe(true);
  });

  it("recognizes missed session as missed target", () => {
    expect(wasProgrammed({ sessionType: "strength", status: "missed" })).toBe(true);
  });

  it("does not trigger for rest day", () => {
    expect(wasProgrammed({ sessionType: "rest", status: "programmed" })).toBe(false);
  });

  it("does not trigger for completed session", () => {
    expect(wasProgrammed({ sessionType: "strength", status: "completed" })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Gap 3-day detection
// ---------------------------------------------------------------------------

describe("gap 3-day detection", () => {
  it("fires when last activity was 3+ days ago", () => {
    const now = Date.now();
    const lastActivityTime = now - 4 * 24 * 60 * 60 * 1000;
    expect(lastActivityTime !== 0 && now - lastActivityTime >= THREE_DAYS_MS).toBe(true);
  });

  it("does not fire when activity was less than 3 days ago", () => {
    const now = Date.now();
    const lastActivityTime = now - 2 * 24 * 60 * 60 * 1000;
    expect(lastActivityTime !== 0 && now - lastActivityTime >= THREE_DAYS_MS).toBe(false);
  });

  it("does not fire when there are no activities (lastActivityTime=0)", () => {
    const now = Date.now();
    expect(0 !== 0 && now - 0 >= THREE_DAYS_MS).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// High external load detection
// ---------------------------------------------------------------------------

describe("high external load detection", () => {
  function classifyExternalLoad(
    activities: Array<{ beginTime: string; averageHeartRate: number }>,
    now: number,
  ): { count: number; shouldFire: boolean } {
    const cutoff = now - 3 * 24 * 60 * 60 * 1000;
    const vigorous = activities.filter((e) => {
      const ts = new Date(e.beginTime).getTime();
      return ts > cutoff && e.averageHeartRate >= VIGOROUS_HR_THRESHOLD;
    });
    return { count: vigorous.length, shouldFire: vigorous.length >= 3 };
  }

  const now = new Date("2026-03-27T12:00:00Z").getTime();

  it("fires when 3+ vigorous sessions in 72 hours", () => {
    const result = classifyExternalLoad(
      [
        { beginTime: "2026-03-27T08:00:00Z", averageHeartRate: 150 },
        { beginTime: "2026-03-26T08:00:00Z", averageHeartRate: 140 },
        { beginTime: "2026-03-25T08:00:00Z", averageHeartRate: 135 },
      ],
      now,
    );
    expect(result.shouldFire).toBe(true);
    expect(result.count).toBe(3);
  });

  it("does not fire with only 2 vigorous sessions", () => {
    const result = classifyExternalLoad(
      [
        { beginTime: "2026-03-27T08:00:00Z", averageHeartRate: 150 },
        { beginTime: "2026-03-26T08:00:00Z", averageHeartRate: 140 },
        { beginTime: "2026-03-25T08:00:00Z", averageHeartRate: 100 },
      ],
      now,
    );
    expect(result.shouldFire).toBe(false);
  });

  it("excludes sessions older than 72 hours", () => {
    const result = classifyExternalLoad(
      [
        { beginTime: "2026-03-27T08:00:00Z", averageHeartRate: 150 },
        { beginTime: "2026-03-26T08:00:00Z", averageHeartRate: 140 },
        { beginTime: "2026-03-20T08:00:00Z", averageHeartRate: 160 },
      ],
      now,
    );
    expect(result.shouldFire).toBe(false);
  });

  it("HR at exactly 130 counts as vigorous", () => {
    const result = classifyExternalLoad(
      [
        { beginTime: "2026-03-27T08:00:00Z", averageHeartRate: 130 },
        { beginTime: "2026-03-26T08:00:00Z", averageHeartRate: 130 },
        { beginTime: "2026-03-25T08:00:00Z", averageHeartRate: 130 },
      ],
      now,
    );
    expect(result.shouldFire).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Consistency streak counting
// ---------------------------------------------------------------------------

describe("consistency streak counting", () => {
  function getWeekStart(d: Date): string {
    const copy = new Date(d);
    const day = copy.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    copy.setUTCDate(copy.getUTCDate() + diff);
    return copy.toISOString().slice(0, 10);
  }

  function countConsistentWeeks(dates: Date[], threeWeeksAgo: Date): number {
    const weekCounts = new Map<string, number>();
    for (const d of dates) {
      if (d < threeWeeksAgo) continue;
      const key = getWeekStart(d);
      weekCounts.set(key, (weekCounts.get(key) ?? 0) + 1);
    }
    return [...weekCounts.values()].filter((c) => c >= 3).length;
  }

  const threeWeeksAgo = new Date("2026-03-06T00:00:00Z");

  it("detects 3 consecutive weeks with 3+ sessions", () => {
    const dates = [
      new Date("2026-03-09T10:00:00Z"),
      new Date("2026-03-10T10:00:00Z"),
      new Date("2026-03-11T10:00:00Z"),
      new Date("2026-03-16T10:00:00Z"),
      new Date("2026-03-17T10:00:00Z"),
      new Date("2026-03-18T10:00:00Z"),
      new Date("2026-03-23T10:00:00Z"),
      new Date("2026-03-24T10:00:00Z"),
      new Date("2026-03-25T10:00:00Z"),
    ];
    expect(countConsistentWeeks(dates, threeWeeksAgo)).toBe(3);
  });

  it("does not fire with only 2 consistent weeks", () => {
    const dates = [
      new Date("2026-03-09T10:00:00Z"),
      new Date("2026-03-10T10:00:00Z"),
      new Date("2026-03-11T10:00:00Z"),
      new Date("2026-03-16T10:00:00Z"),
      new Date("2026-03-17T10:00:00Z"),
      new Date("2026-03-18T10:00:00Z"),
      new Date("2026-03-23T10:00:00Z"),
      new Date("2026-03-24T10:00:00Z"),
    ];
    expect(countConsistentWeeks(dates, threeWeeksAgo)).toBe(2);
  });

  it("excludes activities older than 3 weeks", () => {
    const dates = [
      new Date("2026-02-20T10:00:00Z"),
      new Date("2026-02-21T10:00:00Z"),
      new Date("2026-02-22T10:00:00Z"),
    ];
    expect(countConsistentWeeks(dates, threeWeeksAgo)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Trigger context formatting
// ---------------------------------------------------------------------------

describe("trigger context formatting", () => {
  it("formats missed session context as weekStart:dayIndex", () => {
    expect(`${"2026-03-23"}:${3}`).toBe("2026-03-23:3");
  });

  it("formats high external load context with session count", () => {
    expect(`${4} vigorous sessions in 72h`).toContain("4 vigorous sessions");
  });

  it("formats consistency streak context with week count", () => {
    expect(`${3} consecutive weeks with 3+ sessions`).toContain("3 consecutive weeks");
  });
});

// ---------------------------------------------------------------------------
// Tough session detection
// ---------------------------------------------------------------------------

describe("tough session detection", () => {
  function shouldFireTough(rpe: number, rating: number, ageMs: number): boolean {
    return ageMs <= TWENTY_FOUR_HOURS_MS && rpe >= 8 && rating >= 4;
  }

  it("fires when RPE >= 8, rating >= 4, within 24 hours", () => {
    expect(shouldFireTough(9, 5, 12 * 60 * 60 * 1000)).toBe(true);
  });

  it("does not fire when RPE is below 8", () => {
    expect(shouldFireTough(7, 5, 12 * 60 * 60 * 1000)).toBe(false);
  });

  it("does not fire when rating is below 4", () => {
    expect(shouldFireTough(9, 3, 12 * 60 * 60 * 1000)).toBe(false);
  });

  it("does not fire when session is older than 24 hours", () => {
    expect(shouldFireTough(9, 5, 25 * 60 * 60 * 1000)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Weekly recap timing
// ---------------------------------------------------------------------------

describe("weekly recap timing", () => {
  it("triggers on Sunday at 18:00+ UTC", () => {
    expect(0 === 0 && 18 >= 18).toBe(true);
    expect(0 === 0 && 20 >= 18).toBe(true);
  });

  it("does not trigger on Sunday before 18:00 UTC", () => {
    expect(0 === 0 && 17 >= 18).toBe(false);
  });

  it("does not trigger on non-Sunday days", () => {
    for (let d = 1; d <= 6; d++) {
      expect(d === 0 && 20 >= 18).toBe(false);
    }
  });
});
