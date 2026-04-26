import { describe, expect, it } from "vitest";
import { compactWellnessFields } from "./wellnessDaily";

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
});
