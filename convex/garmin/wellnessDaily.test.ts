import { describe, expect, it } from "vitest";
import { compactWellnessFields, mergeWellnessFields } from "./wellnessDaily";

describe("compactWellnessFields", () => {
  it("removes undefined fields so partial Garmin summaries do not clear existing data", () => {
    expect(
      compactWellnessFields({
        avgStress: undefined,
        hrvLastNightAvg: 42,
        sleepScore: undefined,
        steps: 10_000,
      }),
    ).toEqual({
      hrvLastNightAvg: 42,
      steps: 10_000,
    });
  });

  it("preserves defined falsy numeric values", () => {
    expect(
      compactWellnessFields({
        avgStress: 0,
        steps: 0,
        skinTempDeviationCelsius: 0,
      }),
    ).toEqual({
      avgStress: 0,
      steps: 0,
      skinTempDeviationCelsius: 0,
    });
  });

  it("returns an empty object when every field is undefined", () => {
    expect(
      compactWellnessFields({
        avgStress: undefined,
        hrvLastNightAvg: undefined,
      }),
    ).toEqual({});
  });
});

describe("mergeWellnessFields", () => {
  it("keeps the highest body battery value across multiple same-day windows", () => {
    expect(
      mergeWellnessFields(
        { bodyBatteryHighestValue: 80, bodyBatteryLowestValue: undefined },
        { bodyBatteryHighestValue: 65 },
      ),
    ).toEqual({ bodyBatteryHighestValue: 80 });
  });

  it("keeps the lowest body battery value across multiple same-day windows", () => {
    expect(
      mergeWellnessFields(
        { bodyBatteryHighestValue: undefined, bodyBatteryLowestValue: 25 },
        { bodyBatteryLowestValue: 44 },
      ),
    ).toEqual({ bodyBatteryLowestValue: 25 });
  });

  it("accepts new extrema when later windows extend the daily range", () => {
    expect(
      mergeWellnessFields(
        { bodyBatteryHighestValue: 70, bodyBatteryLowestValue: 40 },
        {
          bodyBatteryHighestValue: 91,
          bodyBatteryLowestValue: 18,
          avgStress: 32,
        },
      ),
    ).toEqual({
      bodyBatteryHighestValue: 91,
      bodyBatteryLowestValue: 18,
      avgStress: 32,
    });
  });
});
