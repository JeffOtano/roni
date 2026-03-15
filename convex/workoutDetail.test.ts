import { describe, expect, it } from "vitest";
import { filterCatalog } from "./workoutDetail";
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
