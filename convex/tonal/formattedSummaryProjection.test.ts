import { describe, expect, it } from "vitest";
import {
  projectFormattedSummary,
  projectFormattedSummaryStrict,
} from "./formattedSummaryProjection";
import { estimateCacheValueBytes } from "./proxyCacheLimits";

function makeRawSummary(movementCount: number, repsPerMovement: number): unknown {
  return {
    workoutId: "w-1",
    summaryId: "wa-1",
    totalDuration: 3600,
    movementSets: Array.from({ length: movementCount }, (_, mi) => ({
      movementId: `mov-${mi}`,
      totalVolume: 1000 + mi,
      totalOnMachineVolume: 800,
      totalWork: 50000,
      sets: Array.from({ length: repsPerMovement }, (_, ri) => ({
        repId: `rep-${mi}-${ri}`,
        weightLbs: 100,
        reps: 10,
      })),
      heartRateSamples: Array.from({ length: 100 }, (_, i) => i),
    })),
  };
}

describe("projectFormattedSummary", () => {
  it("returns empty movementSets for non-object payloads", () => {
    expect(projectFormattedSummary(null)).toEqual({ movementSets: [] });
    expect(projectFormattedSummary("nope")).toEqual({ movementSets: [] });
    expect(projectFormattedSummary([])).toEqual({ movementSets: [] });
  });

  it("retains only movementId and totalVolume per movement", () => {
    const projected = projectFormattedSummary(makeRawSummary(3, 2));

    expect(projected.movementSets).toHaveLength(3);
    for (const ms of projected.movementSets) {
      expect(Object.keys(ms).sort()).toEqual(["movementId", "totalVolume"]);
    }
  });

  it("drops top-level fields outside the projected schema", () => {
    const projected = projectFormattedSummary(makeRawSummary(1, 1));

    expect(Object.keys(projected)).toEqual(["movementSets"]);
  });

  it("treats absent movementSets as an empty list", () => {
    expect(projectFormattedSummary({})).toEqual({ movementSets: [] });
  });

  it("produces a smaller cache footprint than the raw response", () => {
    const raw = makeRawSummary(40, 50);

    const projected = projectFormattedSummary(raw);

    expect(estimateCacheValueBytes(projected)).toBeLessThan(estimateCacheValueBytes(raw));
  });

  it("preserves the totalVolume readers rely on", () => {
    const projected = projectFormattedSummary(makeRawSummary(2, 0));

    expect(projected.movementSets[0]).toEqual({ movementId: "mov-0", totalVolume: 1000 });
    expect(projected.movementSets[1]).toEqual({ movementId: "mov-1", totalVolume: 1001 });
  });
});

describe("projectFormattedSummaryStrict", () => {
  it("projects valid input the same as the lenient variant", () => {
    const projected = projectFormattedSummaryStrict(makeRawSummary(1, 1));
    expect(projected.movementSets).toHaveLength(1);
  });

  it("throws on non-object input so cachedFetch falls back to stale data", () => {
    expect(() => projectFormattedSummaryStrict(null)).toThrow(/expected object/);
    expect(() => projectFormattedSummaryStrict([])).toThrow(/expected object/);
  });

  it("throws on schema mismatch instead of returning empty movementSets", () => {
    const malformed = { movementSets: [{ movementId: "m-1" }] };
    expect(() => projectFormattedSummaryStrict(malformed)).toThrow();
  });

  it("throws when movementSets is absent so cachedFetch does not cache an empty placeholder", () => {
    expect(() => projectFormattedSummaryStrict({})).toThrow();
    expect(() => projectFormattedSummaryStrict({ summaryId: "wa-1" })).toThrow();
  });
});
