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

  it("returns empty movementSets on field-level schema mismatch (graceful degradation, no Sentry noise)", () => {
    // Tonal sometimes omits totalVolume for certain set types; this is not
    // drift worth throwing on — just return an empty list so the caller gets
    // a usable (if incomplete) result.
    const malformed = { movementSets: [{ movementId: "m-1" }] };
    expect(projectFormattedSummaryStrict(malformed)).toEqual({ movementSets: [] });
  });

  it("returns empty movementSets when movementSets is absent (regression: TONALCOACH-3P)", () => {
    // Tonal legitimately omits movementSets for free-form / external-session
    // workout types. The strict variant must NOT throw — doing so was creating
    // Sentry noise every time such a summary was fetched fresh.
    expect(projectFormattedSummaryStrict({})).toEqual({ movementSets: [] });
    expect(projectFormattedSummaryStrict({ summaryId: "wa-1" })).toEqual({ movementSets: [] });
  });

  it("returns empty movementSets when one entry in movementSets is malformed", () => {
    const mixed = {
      movementSets: [
        { movementId: "mov-0", totalVolume: 1000 },
        { movementId: "mov-1" }, // missing totalVolume
        { movementId: "mov-2", totalVolume: 1002 },
      ],
    };
    expect(projectFormattedSummaryStrict(mixed)).toEqual({ movementSets: [] });
  });
});
