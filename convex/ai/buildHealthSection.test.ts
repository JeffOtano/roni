import { describe, expect, it } from "vitest";
import { buildHealthSection, type HealthSnapshotData } from "./snapshotHelpers";

// ---------------------------------------------------------------------------
// Test data builder
// ---------------------------------------------------------------------------

function makeSnapshot(overrides: Partial<HealthSnapshotData> = {}): HealthSnapshotData {
  return {
    date: "2026-03-27",
    syncedAt: new Date("2026-03-27T08:00:00Z").getTime(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// buildHealthSection
// ---------------------------------------------------------------------------

describe("buildHealthSection", () => {
  const now = new Date("2026-03-27T12:00:00Z");

  it("returns null for empty snapshots array", () => {
    expect(buildHealthSection([], now)).toBeNull();
  });

  it("returns null when snapshot has no meaningful data fields", () => {
    expect(buildHealthSection([makeSnapshot()], now)).toBeNull();
  });

  it("has priority 8.5", () => {
    const result = buildHealthSection([makeSnapshot({ steps: 5000 })], now);
    expect(result!.priority).toBe(8.5);
  });

  it("includes activity data when present", () => {
    const result = buildHealthSection(
      [makeSnapshot({ steps: 8500, activeEnergyBurned: 450, exerciseMinutes: 32 })],
      now,
    );

    expect(result!.lines.some((l) => l.includes("8,500 steps"))).toBe(true);
    expect(result!.lines.some((l) => l.includes("450 kcal active"))).toBe(true);
    expect(result!.lines.some((l) => l.includes("32 min exercise"))).toBe(true);
  });

  it("includes sleep duration and breakdown", () => {
    const result = buildHealthSection(
      [
        makeSnapshot({
          sleepDurationMinutes: 470,
          sleepDeepMinutes: 60,
          sleepRemMinutes: 90,
          sleepCoreMinutes: 280,
        }),
      ],
      now,
    );
    const sleepLine = result!.lines.find((l) => l.includes("Last night"));

    expect(sleepLine).toContain("7h 50m sleep");
    expect(sleepLine).toContain("60m deep");
    expect(sleepLine).toContain("90m REM");
    expect(sleepLine).toContain("280m core");
  });

  it("includes sleep times when provided", () => {
    const result = buildHealthSection(
      [
        makeSnapshot({
          sleepDurationMinutes: 480,
          sleepStartTime: "2026-03-26T22:30:00Z",
          sleepEndTime: "2026-03-27T06:30:00Z",
        }),
      ],
      now,
    );
    const sleepLine = result!.lines.find((l) => l.includes("Last night"));

    expect(sleepLine).toContain("Bed 22:30");
    expect(sleepLine).toContain("06:30");
  });

  it("includes resting heart rate", () => {
    const result = buildHealthSection([makeSnapshot({ restingHeartRate: 58 })], now);
    expect(result!.lines.some((l) => l.includes("RHR 58 bpm"))).toBe(true);
  });

  it("includes HRV with trend when 3+ data points available", () => {
    const snapshots = [
      makeSnapshot({ date: "2026-03-27", hrvSDNN: 45 }),
      makeSnapshot({ date: "2026-03-26", hrvSDNN: 42 }),
      makeSnapshot({ date: "2026-03-25", hrvSDNN: 40 }),
    ];
    const heartLine = buildHealthSection(snapshots, now)!.lines.find((l) => l.includes("HRV"));

    expect(heartLine).toContain("HRV 45ms");
    expect(heartLine).toContain("7-day avg");
  });

  it("omits HRV trend when fewer than 3 data points", () => {
    const snapshots = [
      makeSnapshot({ date: "2026-03-27", hrvSDNN: 45 }),
      makeSnapshot({ date: "2026-03-26", hrvSDNN: 42 }),
    ];
    const heartLine = buildHealthSection(snapshots, now)!.lines.find((l) => l.includes("HRV"));

    expect(heartLine).toContain("HRV 45ms");
    expect(heartLine).not.toContain("7-day avg");
  });

  it("shows trending up when HRV is significantly above average", () => {
    const snapshots = [
      makeSnapshot({ date: "2026-03-27", hrvSDNN: 60 }),
      makeSnapshot({ date: "2026-03-26", hrvSDNN: 50 }),
      makeSnapshot({ date: "2026-03-25", hrvSDNN: 50 }),
    ];
    const heartLine = buildHealthSection(snapshots, now)!.lines.find((l) => l.includes("HRV"));
    expect(heartLine).toContain("trending up");
  });

  it("shows trending down when HRV is significantly below average", () => {
    const snapshots = [
      makeSnapshot({ date: "2026-03-27", hrvSDNN: 40 }),
      makeSnapshot({ date: "2026-03-26", hrvSDNN: 50 }),
      makeSnapshot({ date: "2026-03-25", hrvSDNN: 50 }),
    ];
    const heartLine = buildHealthSection(snapshots, now)!.lines.find((l) => l.includes("HRV"));
    expect(heartLine).toContain("trending down");
  });

  it("shows stable when HRV is near average", () => {
    const snapshots = [
      makeSnapshot({ date: "2026-03-27", hrvSDNN: 50 }),
      makeSnapshot({ date: "2026-03-26", hrvSDNN: 50 }),
      makeSnapshot({ date: "2026-03-25", hrvSDNN: 50 }),
    ];
    const heartLine = buildHealthSection(snapshots, now)!.lines.find((l) => l.includes("HRV"));
    expect(heartLine).toContain("stable");
  });

  it("includes VO2 Max", () => {
    const result = buildHealthSection([makeSnapshot({ vo2Max: 42.3 })], now);
    expect(result!.lines.some((l) => l.includes("VO2 Max 42.3"))).toBe(true);
  });

  it("includes body mass with trend when 2+ data points", () => {
    const snapshots = [
      makeSnapshot({ date: "2026-03-27", bodyMass: 80.5 }),
      makeSnapshot({ date: "2026-03-26", bodyMass: 81.0 }),
    ];
    const bodyLine = buildHealthSection(snapshots, now)!.lines.find((l) => l.includes("Body"));

    expect(bodyLine).toContain("80.5 kg");
    expect(bodyLine).toContain("7-day trend");
  });

  it("includes nutrition data", () => {
    const result = buildHealthSection(
      [makeSnapshot({ dietaryCalories: 2200, dietaryProteinGrams: 150 })],
      now,
    );
    expect(result!.lines.some((l) => l.includes("2200 kcal"))).toBe(true);
    expect(result!.lines.some((l) => l.includes("150g protein"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// buildHealthSection: recovery signals
// ---------------------------------------------------------------------------

describe("buildHealthSection recovery signals", () => {
  const now = new Date("2026-03-27T12:00:00Z");

  it("detects HRV declining 3+ consecutive days", () => {
    const snapshots = [
      makeSnapshot({ date: "2026-03-27", hrvSDNN: 30 }),
      makeSnapshot({ date: "2026-03-26", hrvSDNN: 35 }),
      makeSnapshot({ date: "2026-03-25", hrvSDNN: 40 }),
      makeSnapshot({ date: "2026-03-24", hrvSDNN: 45 }),
    ];
    const result = buildHealthSection(snapshots, now);
    expect(result!.lines.some((l) => l.includes("HRV declining"))).toBe(true);
  });

  it("does not flag HRV declining when trend is flat", () => {
    const snapshots = [
      makeSnapshot({ date: "2026-03-27", hrvSDNN: 45 }),
      makeSnapshot({ date: "2026-03-26", hrvSDNN: 45 }),
      makeSnapshot({ date: "2026-03-25", hrvSDNN: 45 }),
    ];
    const result = buildHealthSection(snapshots, now);
    expect(result!.lines.some((l) => l.includes("HRV declining"))).toBe(false);
  });

  it("detects poor sleep when 2+ of last 3 nights below 7 hours", () => {
    const snapshots = [
      makeSnapshot({ date: "2026-03-27", sleepDurationMinutes: 350 }),
      makeSnapshot({ date: "2026-03-26", sleepDurationMinutes: 380 }),
      makeSnapshot({ date: "2026-03-25", sleepDurationMinutes: 500 }),
    ];
    const result = buildHealthSection(snapshots, now);
    expect(result!.lines.some((l) => l.includes("sleep below 7h"))).toBe(true);
  });

  it("does not flag sleep when only 1 night below 7 hours", () => {
    const snapshots = [
      makeSnapshot({ date: "2026-03-27", sleepDurationMinutes: 350 }),
      makeSnapshot({ date: "2026-03-26", sleepDurationMinutes: 480 }),
      makeSnapshot({ date: "2026-03-25", sleepDurationMinutes: 500 }),
    ];
    const result = buildHealthSection(snapshots, now);
    expect(result!.lines.some((l) => l.includes("sleep below 7h"))).toBe(false);
  });

  it("detects elevated RHR (5+ bpm above average)", () => {
    const snapshots = [
      makeSnapshot({ date: "2026-03-27", restingHeartRate: 70 }),
      makeSnapshot({ date: "2026-03-26", restingHeartRate: 60 }),
      makeSnapshot({ date: "2026-03-25", restingHeartRate: 60 }),
    ];
    const result = buildHealthSection(snapshots, now);
    expect(result!.lines.some((l) => l.includes("RHR elevated"))).toBe(true);
  });

  it("does not flag RHR when not elevated above threshold", () => {
    const snapshots = [
      makeSnapshot({ date: "2026-03-27", restingHeartRate: 62 }),
      makeSnapshot({ date: "2026-03-26", restingHeartRate: 60 }),
      makeSnapshot({ date: "2026-03-25", restingHeartRate: 60 }),
    ];
    const result = buildHealthSection(snapshots, now);
    expect(result!.lines.some((l) => l.includes("RHR elevated"))).toBe(false);
  });

  it("detects significant weight drop (>1kg)", () => {
    const snapshots = [
      makeSnapshot({ date: "2026-03-27", bodyMass: 78 }),
      makeSnapshot({ date: "2026-03-26", bodyMass: 79 }),
      makeSnapshot({ date: "2026-03-25", bodyMass: 80 }),
    ];
    const result = buildHealthSection(snapshots, now);
    expect(result!.lines.some((l) => l.includes("weight drop"))).toBe(true);
  });

  it("does not flag weight drop when less than 1kg", () => {
    const snapshots = [
      makeSnapshot({ date: "2026-03-27", bodyMass: 79.5 }),
      makeSnapshot({ date: "2026-03-26", bodyMass: 79.8 }),
      makeSnapshot({ date: "2026-03-25", bodyMass: 80 }),
    ];
    const result = buildHealthSection(snapshots, now);
    expect(result!.lines.some((l) => l.includes("weight drop"))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildHealthSection: stale data and degradation
// ---------------------------------------------------------------------------

describe("buildHealthSection stale data and degradation", () => {
  const now = new Date("2026-03-27T12:00:00Z");

  it("adds stale data warning when last sync is over 24 hours ago", () => {
    const staleSync = new Date("2026-03-25T08:00:00Z").getTime();
    const result = buildHealthSection([makeSnapshot({ syncedAt: staleSync, steps: 5000 })], now);

    expect(result!.lines[0]).toContain("last synced");
    expect(result!.lines[0]).toContain("day");
  });

  it("does not add stale data warning when sync is recent", () => {
    const recentSync = new Date("2026-03-27T10:00:00Z").getTime();
    const result = buildHealthSection([makeSnapshot({ syncedAt: recentSync, steps: 5000 })], now);
    expect(result!.lines[0]).not.toContain("last synced");
  });

  it("handles snapshots with only partial data", () => {
    const result = buildHealthSection([makeSnapshot({ restingHeartRate: 58 })], now);

    expect(result!.lines.some((l) => l.includes("RHR 58 bpm"))).toBe(true);
    expect(result!.lines.some((l) => l.includes("Today:"))).toBe(false);
    expect(result!.lines.some((l) => l.includes("Last night:"))).toBe(false);
  });

  it("handles single snapshot with all fields populated", () => {
    const result = buildHealthSection(
      [
        makeSnapshot({
          steps: 10000,
          activeEnergyBurned: 500,
          exerciseMinutes: 45,
          sleepDurationMinutes: 480,
          sleepDeepMinutes: 90,
          sleepRemMinutes: 120,
          restingHeartRate: 55,
          hrvSDNN: 50,
          vo2Max: 45.2,
          bodyMass: 75,
          dietaryCalories: 2500,
          dietaryProteinGrams: 180,
        }),
      ],
      now,
    );

    expect(result!.lines.some((l) => l.includes("Today:"))).toBe(true);
    expect(result!.lines.some((l) => l.includes("Last night:"))).toBe(true);
    expect(result!.lines.some((l) => l.includes("Heart:"))).toBe(true);
    expect(result!.lines.some((l) => l.includes("Body:"))).toBe(true);
    expect(result!.lines.some((l) => l.includes("Nutrition:"))).toBe(true);
  });
});
