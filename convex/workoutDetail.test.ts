import { describe, expect, it } from "vitest";
import { buildMovementSummaries, filterCatalog, UUID_RE } from "./workoutDetail";
import type { EnrichedSetActivity } from "./workoutDetail";
import type { Movement } from "./tonal/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMovement(overrides: Partial<Movement> & { id: string; name: string }): Movement {
  return {
    shortName: overrides.name,
    muscleGroups: [],
    inFreeLift: false,
    onMachine: false,
    countReps: true,
    isTwoSided: false,
    isBilateral: false,
    isAlternating: false,
    descriptionHow: "",
    descriptionWhy: "",
    thumbnailMediaUrl: "",
    skillLevel: 1,
    publishState: "published",
    sortOrder: 0,
    ...overrides,
  };
}

const CATALOG: Movement[] = [
  makeMovement({ id: "m1", name: "Bench Press", muscleGroups: ["Chest", "Triceps"] }),
  makeMovement({ id: "m2", name: "Squat", muscleGroups: ["Quads", "Glutes"] }),
  makeMovement({ id: "m3", name: "Overhead Press", muscleGroups: ["Shoulders", "Triceps"] }),
  makeMovement({ id: "m4", name: "Deadlift", muscleGroups: ["Back", "Glutes", "Hamstrings"] }),
  makeMovement({ id: "m5", name: "Tricep Pushdown", muscleGroups: ["Triceps"] }),
];

// ---------------------------------------------------------------------------
// filterCatalog
// ---------------------------------------------------------------------------

describe("filterCatalog", () => {
  describe("search by name", () => {
    it("returns movements whose name contains the search string (case-insensitive)", () => {
      const results = filterCatalog(CATALOG, { search: "press" });

      expect(results).toHaveLength(2);
      expect(results.map((r) => r.id)).toEqual(expect.arrayContaining(["m1", "m3"]));
    });

    it("matches regardless of case", () => {
      const lower = filterCatalog(CATALOG, { search: "bench" });
      const upper = filterCatalog(CATALOG, { search: "BENCH" });
      const mixed = filterCatalog(CATALOG, { search: "BeNcH" });

      expect(lower).toEqual(upper);
      expect(lower).toEqual(mixed);
      expect(lower).toHaveLength(1);
    });

    it("returns empty array when no names match the search string", () => {
      const results = filterCatalog(CATALOG, { search: "zzznotfound" });

      expect(results).toHaveLength(0);
    });

    it("returns all movements when search string is empty", () => {
      const results = filterCatalog(CATALOG, { search: "" });

      // empty string is falsy so the filter branch is skipped
      expect(results).toHaveLength(CATALOG.length);
    });
  });

  describe("filter by muscle group", () => {
    it("returns movements that include the given muscle group (case-insensitive)", () => {
      const results = filterCatalog(CATALOG, { muscleGroup: "Triceps" });

      expect(results).toHaveLength(3);
      expect(results.map((r) => r.id)).toEqual(expect.arrayContaining(["m1", "m3", "m5"]));
    });

    it("performs case-insensitive muscle group match", () => {
      const lower = filterCatalog(CATALOG, { muscleGroup: "glutes" });
      const upper = filterCatalog(CATALOG, { muscleGroup: "GLUTES" });

      expect(lower).toEqual(upper);
      expect(lower).toHaveLength(2);
    });

    it("returns empty array when muscle group matches nothing", () => {
      const results = filterCatalog(CATALOG, { muscleGroup: "Calves" });

      expect(results).toHaveLength(0);
    });
  });

  describe("combined search and muscle group filter", () => {
    it("applies both search and muscleGroup filters simultaneously", () => {
      // "press" matches Bench Press and Overhead Press; of those, only Overhead Press has Shoulders
      const results = filterCatalog(CATALOG, { search: "press", muscleGroup: "shoulders" });

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("m3");
    });

    it("returns empty array when combined filters produce no matches", () => {
      const results = filterCatalog(CATALOG, { search: "squat", muscleGroup: "triceps" });

      expect(results).toHaveLength(0);
    });
  });

  describe("result shape", () => {
    it("maps movements to CatalogEntry shape (id, name, muscleGroups, skillLevel, thumbnailMediaUrl, onMachine)", () => {
      const movement = makeMovement({
        id: "m-shape",
        name: "Curl",
        muscleGroups: ["Biceps"],
        skillLevel: 2,
        thumbnailMediaUrl: "https://cdn.example.com/curl.jpg",
        onMachine: true,
      });

      const results = filterCatalog([movement], {});

      expect(results[0]).toEqual({
        id: "m-shape",
        name: "Curl",
        muscleGroups: ["Biceps"],
        skillLevel: 2,
        thumbnailMediaUrl: "https://cdn.example.com/curl.jpg",
        onMachine: true,
      });
    });
  });

  describe("limit to 50 results", () => {
    it("returns at most 50 entries even when catalog is larger", () => {
      const largeCatalog: Movement[] = Array.from({ length: 80 }, (_, i) =>
        makeMovement({ id: `m-${i}`, name: `Move ${i}`, muscleGroups: [] }),
      );

      const results = filterCatalog(largeCatalog, {});

      expect(results).toHaveLength(50);
    });

    it("returns fewer than 50 when filtered results are below the limit", () => {
      const results = filterCatalog(CATALOG, { search: "bench" });

      expect(results.length).toBeLessThan(50);
      expect(results).toHaveLength(1);
    });
  });

  describe("edge cases", () => {
    it("returns empty array for empty catalog", () => {
      const results = filterCatalog([], { search: "bench" });

      expect(results).toHaveLength(0);
    });

    it("returns all results when no filters are provided", () => {
      const results = filterCatalog(CATALOG, {});

      expect(results).toHaveLength(CATALOG.length);
    });
  });
});

// ---------------------------------------------------------------------------
// buildMovementSummaries
// ---------------------------------------------------------------------------

function makeSet(overrides: Partial<EnrichedSetActivity>): EnrichedSetActivity {
  return {
    id: "s1",
    movementId: "m1",
    movementName: "Test Move",
    muscleGroups: ["Chest"],
    prescribedReps: 10,
    repetition: 10,
    repetitionTotal: 10,
    blockNumber: 1,
    spotter: false,
    eccentric: false,
    chains: false,
    flex: false,
    warmUp: false,
    beginTime: "2026-04-15T10:00:00Z",
    sideNumber: 0,
    avgWeight: 50,
    ...overrides,
  };
}

describe("buildMovementSummaries", () => {
  it("aggregates sets by movementId", () => {
    const sets = [
      makeSet({ id: "s1", movementId: "m1", repetition: 10 }),
      makeSet({ id: "s2", movementId: "m1", repetition: 8 }),
      makeSet({ id: "s3", movementId: "m2", movementName: "Other", repetition: 12 }),
    ];

    const result = buildMovementSummaries(sets, new Map());

    expect(result).toHaveLength(2);
    const m1 = result.find((r) => r.movementId === "m1")!;
    expect(m1.totalSets).toBe(2);
    expect(m1.totalReps).toBe(18);
  });

  it("computes weighted avgWeightLbs from per-set avgWeight", () => {
    const sets = [
      makeSet({
        id: "s1",
        movementId: "bar1",
        movementName: "Barbell Front Squat",
        avgWeight: 94,
        repetition: 8,
      }),
      makeSet({
        id: "s2",
        movementId: "bar1",
        movementName: "Barbell Front Squat",
        avgWeight: 100,
        repetition: 12,
      }),
    ];

    const result = buildMovementSummaries(sets, new Map());
    const summary = result.find((r) => r.movementId === "bar1")!;

    expect(summary.totalSets).toBe(2);
    expect(summary.totalReps).toBe(20);
    // Weighted: (94*8 + 100*12) / 20 = 97.6 -> 98
    expect(summary.avgWeightLbs).toBe(98);
  });

  it("returns avgWeightLbs 0 when sets have no avgWeight", () => {
    const sets = [makeSet({ id: "s1", movementId: "m1", avgWeight: undefined })];

    const result = buildMovementSummaries(sets, new Map());
    expect(result[0].avgWeightLbs).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// activityId format validation (regression: TONALCOACH-1H)
// ---------------------------------------------------------------------------
// The getWorkoutDetail action returns null (instead of throwing) when the
// activityId is not a UUID. Sentry was capturing the throw as an uncaught
// error every time a date-formatted ID was passed (e.g. "2026-04-25").
// These tests verify the UUID regex correctly classifies inputs so the
// guard condition stays accurate as the codebase evolves.

describe("activityId UUID format", () => {
  it("accepts canonical UUID v4 strings", () => {
    expect(UUID_RE.test("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
    expect(UUID_RE.test("123e4567-e89b-12d3-a456-426614174000")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(UUID_RE.test("550E8400-E29B-41D4-A716-446655440000")).toBe(true);
  });

  it("rejects date strings (the input that triggered TONALCOACH-1H)", () => {
    expect(UUID_RE.test("2026-04-25")).toBe(false);
    expect(UUID_RE.test("2026-04-25T00:00:00Z")).toBe(false);
  });

  it("rejects other non-UUID strings", () => {
    expect(UUID_RE.test("not-a-uuid")).toBe(false);
    expect(UUID_RE.test("")).toBe(false);
    expect(UUID_RE.test("2026-04")).toBe(false);
  });
});
