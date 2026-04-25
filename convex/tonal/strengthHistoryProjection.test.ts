import { describe, expect, it } from "vitest";
import { projectStrengthHistory, projectStrengthHistoryStrict } from "./strengthHistoryProjection";
import { estimateCacheValueBytes } from "./proxyCacheLimits";

const VALID_ENTRY = {
  id: "sh-1",
  userId: "u-1",
  workoutActivityId: "wa-1",
  upper: 410,
  lower: 520,
  core: 380,
  overall: 437,
  activityTime: "2026-04-17T10:00:00Z",
};

describe("projectStrengthHistory", () => {
  it("returns an empty array for non-array payloads", () => {
    expect(projectStrengthHistory(null)).toEqual([]);
    expect(projectStrengthHistory(undefined)).toEqual([]);
    expect(projectStrengthHistory({ entries: [] })).toEqual([]);
  });

  it("strips per-row id and userId fields", () => {
    const result = projectStrengthHistory([VALID_ENTRY]);

    expect(result).toHaveLength(1);
    expect(result[0]).not.toHaveProperty("id");
    expect(result[0]).not.toHaveProperty("userId");
  });

  it("retains every field readers consume", () => {
    const result = projectStrengthHistory([VALID_ENTRY]);

    expect(result[0]).toEqual({
      workoutActivityId: VALID_ENTRY.workoutActivityId,
      upper: VALID_ENTRY.upper,
      lower: VALID_ENTRY.lower,
      core: VALID_ENTRY.core,
      overall: VALID_ENTRY.overall,
      activityTime: VALID_ENTRY.activityTime,
    });
  });

  it("rejects payloads missing required fields", () => {
    const malformed = [{ ...VALID_ENTRY, overall: undefined }];
    expect(projectStrengthHistory(malformed)).toEqual([]);
  });

  it("produces a smaller cache footprint than the raw response", () => {
    const raw = Array.from({ length: 200 }, (_, i) => ({
      ...VALID_ENTRY,
      id: `sh-${i}`,
      workoutActivityId: `wa-${i}`,
    }));

    const projected = projectStrengthHistory(raw);

    expect(estimateCacheValueBytes(projected)).toBeLessThan(estimateCacheValueBytes(raw));
  });
});

describe("projectStrengthHistoryStrict", () => {
  it("returns the same projected shape on valid input", () => {
    const result = projectStrengthHistoryStrict([VALID_ENTRY]);
    expect(result).toHaveLength(1);
    expect(result[0]).not.toHaveProperty("id");
  });

  it("throws on non-array input so cachedFetch falls back to stale data", () => {
    expect(() => projectStrengthHistoryStrict(null)).toThrow(/expected array/);
    expect(() => projectStrengthHistoryStrict({ entries: [] })).toThrow(/expected array/);
  });

  it("throws on schema mismatch instead of returning an empty array", () => {
    const malformed = [{ ...VALID_ENTRY, overall: undefined }];
    expect(() => projectStrengthHistoryStrict(malformed)).toThrow();
  });

  it("rejects the whole array when one entry is malformed", () => {
    const mixed = [VALID_ENTRY, { ...VALID_ENTRY, overall: undefined }, VALID_ENTRY];
    expect(() => projectStrengthHistoryStrict(mixed)).toThrow();
  });
});
