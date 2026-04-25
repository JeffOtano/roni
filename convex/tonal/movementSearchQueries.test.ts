/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "../_generated/api";
import schema from "../schema";
import { buildListSearchText } from "./movementSearch";
import { mapApiToDoc } from "./movementMapping";
import type { Movement } from "./types";

// Vite normalizes same-directory glob keys to "./foo.ts" instead of
// "../tonal/foo.ts", which breaks convex-test module resolution.
// Remap ./foo.ts -> ../tonal/foo.ts to match the expected path format.
const rawModules = import.meta.glob("../**/*.*s");
const modules: typeof rawModules = {};
for (const [key, value] of Object.entries(rawModules)) {
  modules[key.startsWith("./") ? "../tonal/" + key.slice(2) : key] = value;
}

function makeMovement(overrides: Partial<Movement> = {}): Movement {
  return {
    id: "move-1",
    name: "Bench Press",
    shortName: "Bench Press",
    muscleGroups: ["Chest", "Triceps"],
    inFreeLift: false,
    onMachine: true,
    countReps: true,
    isTwoSided: false,
    isBilateral: true,
    isAlternating: false,
    descriptionHow: "Lie on the bench and press the handles up.",
    descriptionWhy: "Builds pressing strength.",
    skillLevel: 3,
    publishState: "published",
    sortOrder: 100,
    ...overrides,
  };
}

function makeDoc(overrides: Partial<Movement> = {}) {
  return mapApiToDoc(makeMovement(overrides), 1000);
}

function makeOldDocWithoutSearchFields(overrides: Partial<Movement> = {}) {
  const {
    nameSearchText: _nameSearchText,
    muscleGroupsSearchText: _muscleGroupsSearchText,
    trainingTypesSearchText: _trainingTypesSearchText,
    ...doc
  } = makeDoc(overrides);
  return doc;
}

type BackfillResult = { scanned: number; patched: number; hasMore: boolean; cursor: string | null };

async function runBackfillToCompletion(t: ReturnType<typeof convexTest>) {
  let cursor: string | null = null;
  for (;;) {
    const result: BackfillResult = await t.mutation(
      internal.tonal.movementSearchQueries.backfillMovementSearchFields,
      { cursor },
    );
    if (!result.hasMore) return;
    cursor = result.cursor;
  }
}

describe("searchMovements", () => {
  test("finds name aliases through the search index", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert(
        "movements",
        makeDoc({
          id: "move-rdl",
          name: "Romanian Deadlift",
          shortName: "Romanian Deadlift",
          muscleGroups: ["Hamstrings", "Glutes"],
        }),
      );
      await ctx.db.insert("movements", makeDoc({ id: "move-bench", name: "Bench Press" }));
    });
    await runBackfillToCompletion(t);

    const results = await t.query(internal.tonal.movementSearchQueries.searchMovements, {
      name: "RDL",
      limit: 30,
    });

    expect(results.map((movement) => movement.id)).toEqual(["move-rdl"]);
  });

  test("uses indexed candidates and exact-filters the remaining predicates", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("movements", {
        ...makeDoc({ id: "move-bench", name: "Bench Press", muscleGroups: ["Chest", "Triceps"] }),
        trainingTypes: ["Strength"],
        trainingTypesSearchText: buildListSearchText(["Strength"]),
      });
      await ctx.db.insert("movements", {
        ...makeDoc({
          id: "move-stretch",
          name: "Chest Stretch",
          muscleGroups: ["Chest"],
          countReps: false,
        }),
        trainingTypes: ["Mobility"],
        trainingTypesSearchText: buildListSearchText(["Mobility"]),
      });
    });
    await runBackfillToCompletion(t);

    const results = await t.query(internal.tonal.movementSearchQueries.searchMovements, {
      muscleGroup: "Chest",
      trainingType: "Strength",
      limit: 30,
    });

    expect(results.map((movement) => movement.id)).toEqual(["move-bench"]);
  });

  test("preserves results during the search-field backfill window", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      await ctx.db.insert("movements", makeOldDocWithoutSearchFields({ id: "move-bench" }));
    });

    const results = await t.query(internal.tonal.movementSearchQueries.searchMovements, {
      name: "Bench",
      limit: 30,
    });

    expect(results.map((movement) => movement.id)).toEqual(["move-bench"]);
  });

  test("continues through broad index results until exact filters match", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      for (let i = 0; i < 350; i++) {
        await ctx.db.insert(
          "movements",
          makeDoc({
            id: `move-common-${i}`,
            name: `Common Press ${i}`,
            shortName: `Common Press ${i}`,
            muscleGroups: ["Common"],
          }),
        );
      }
      await ctx.db.insert(
        "movements",
        makeDoc({
          id: "move-rare",
          name: "Long Rare Press Movement",
          shortName: "Long Rare Press Movement",
          muscleGroups: ["Rare"],
        }),
      );
    });
    await runBackfillToCompletion(t);

    const results = await t.query(internal.tonal.movementSearchQueries.searchMovements, {
      name: "press",
      muscleGroup: "Rare",
      limit: 30,
    });

    expect(results.map((movement) => movement.id)).toEqual(["move-rare"]);
  });

  test("backfills search fields across pages before marking search ready", async () => {
    const t = convexTest(schema, modules);

    await t.run(async (ctx) => {
      for (let i = 0; i < 3; i++) {
        await ctx.db.insert(
          "movements",
          makeOldDocWithoutSearchFields({
            id: `move-old-${i}`,
            name: `Old Press ${i}`,
            shortName: `Old Press ${i}`,
          }),
        );
      }
    });

    const first = await t.mutation(
      internal.tonal.movementSearchQueries.backfillMovementSearchFields,
      {
        limit: 2,
      },
    );
    const stateBeforeDone = await t.run(async (ctx) =>
      ctx.db
        .query("movementSearchState")
        .withIndex("by_key", (q) => q.eq("key", "movement_search_fields"))
        .unique(),
    );

    expect(first).toMatchObject({ scanned: 2, patched: 2, hasMore: true });
    expect(first.cursor).not.toBeNull();
    expect(stateBeforeDone).toBeNull();

    const second = await t.mutation(
      internal.tonal.movementSearchQueries.backfillMovementSearchFields,
      { limit: 2, cursor: first.cursor },
    );
    const stateAfterDone = await t.run(async (ctx) =>
      ctx.db
        .query("movementSearchState")
        .withIndex("by_key", (q) => q.eq("key", "movement_search_fields"))
        .unique(),
    );
    const docs = await t.run(async (ctx) => ctx.db.query("movements").take(10));

    expect(second).toMatchObject({ scanned: 1, patched: 1, hasMore: false });
    expect(stateAfterDone?.version).toBe(1);
    expect(docs.every((doc) => doc.nameSearchText && doc.muscleGroupsSearchText)).toBe(true);
  });

  test("movement sync preserves derived training type search fields", async () => {
    const t = convexTest(schema, modules);

    await t.mutation(internal.tonal.movementSync.batchUpsertMovements, {
      docs: [makeDoc({ id: "move-bench", name: "Bench Press" })],
    });
    await t.mutation(internal.tonal.workoutCatalogSync.batchUpdateMovementTrainingTypes, {
      updates: [{ tonalId: "move-bench", trainingTypes: ["Strength"] }],
    });
    await t.mutation(internal.tonal.movementSync.batchUpsertMovements, {
      docs: [makeDoc({ id: "move-bench", name: "Bench Press Updated" })],
    });

    const doc = await t.run(async (ctx) =>
      ctx.db
        .query("movements")
        .withIndex("by_tonalId", (q) => q.eq("tonalId", "move-bench"))
        .unique(),
    );

    expect(doc?.name).toBe("Bench Press Updated");
    expect(doc?.trainingTypes).toEqual(["Strength"]);
    expect(doc?.trainingTypesSearchText).toBe("strength");
  });
});
