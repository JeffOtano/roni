import { describe, expect, it } from "vitest";
import { formatGarminWellnessLines } from "./garminWellnessSnapshot";

describe("formatGarminWellnessLines", () => {
  it("returns no section when rows are empty or have no recovery fields", () => {
    expect(formatGarminWellnessLines([])).toEqual([]);
    expect(formatGarminWellnessLines([{ calendarDate: "2026-04-24" }])).toEqual([]);
  });

  it("formats recent Garmin recovery metrics for coach context", () => {
    const lines = formatGarminWellnessLines([
      {
        calendarDate: "2026-04-24",
        sleepDurationSeconds: 7.5 * 60 * 60,
        sleepScore: 82,
        hrvLastNightAvg: 61,
        avgStress: 28,
        bodyBatteryLowestValue: 35,
        bodyBatteryHighestValue: 86,
        restingHeartRate: 51,
        avgSpo2: 97,
        avgRespirationRate: 14.2,
        skinTempDeviationCelsius: 0.4,
      },
    ]);

    expect(lines.join("\n")).toContain("Garmin Recovery Signals");
    expect(lines.join("\n")).toContain("2026-04-24 | sleep 7.5h");
    expect(lines.join("\n")).toContain("HRV 61ms");
    expect(lines.join("\n")).toContain("body battery 35-86");
    expect(lines.join("\n")).toContain("skin temp +0.4C");
    expect(lines.join("\n")).toContain("bias toward recovery");
  });
});
