/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { internal } from "../_generated/api";
import schema from "../schema";

// Vite normalizes same-directory glob keys to "./foo.ts" instead of
// "../tonal/foo.ts", which breaks convex-test module resolution.
// Remap ./foo.ts -> ../tonal/foo.ts to match the expected path format.
const rawModules = import.meta.glob("../**/*.*s");
const modules: typeof rawModules = {};
for (const [key, value] of Object.entries(rawModules)) {
  modules[key.startsWith("./") ? "../tonal/" + key.slice(2) : key] = value;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createUser(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => ctx.db.insert("users", {}));
}

const baseReadiness = {
  chest: 0.8,
  shoulders: 0.7,
  back: 0.9,
  triceps: 0.75,
  biceps: 0.85,
  abs: 0.6,
  obliques: 0.65,
  quads: 0.5,
  glutes: 0.55,
  hamstrings: 0.6,
  calves: 0.7,
};

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// persistCurrentStrengthScores
// ---------------------------------------------------------------------------

describe("persistCurrentStrengthScores", () => {
  test("inserts scores and skips unchanged rewrites", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    const t = convexTest(schema, modules);
    const userId = await createUser(t);
    const scores = [
      { bodyRegion: "upper", score: 120 },
      { bodyRegion: "lower", score: 95 },
    ];

    await t.mutation(internal.tonal.historySyncMutations.persistCurrentStrengthScores, {
      userId,
      scores,
    });

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("currentStrengthScores")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect(),
    );
    expect(rows).toHaveLength(2);
    const regions = rows.map((r) => r.bodyRegion).sort();
    expect(regions).toEqual(["lower", "upper"]);

    vi.setSystemTime(2000);
    await t.mutation(internal.tonal.historySyncMutations.persistCurrentStrengthScores, {
      userId,
      scores,
    });

    const after = await t.run(async (ctx) =>
      ctx.db
        .query("currentStrengthScores")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect(),
    );
    expect(after.map((row) => row._id).sort()).toEqual(rows.map((row) => row._id).sort());
    expect(after.map((row) => row.fetchedAt).sort()).toEqual([1000, 1000]);
  });

  test("second call replaces existing scores", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);

    await t.mutation(internal.tonal.historySyncMutations.persistCurrentStrengthScores, {
      userId,
      scores: [{ bodyRegion: "upper", score: 100 }],
    });

    await t.mutation(internal.tonal.historySyncMutations.persistCurrentStrengthScores, {
      userId,
      scores: [
        { bodyRegion: "upper", score: 110 },
        { bodyRegion: "core", score: 80 },
      ],
    });

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("currentStrengthScores")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect(),
    );
    expect(rows).toHaveLength(2);
    const upper = rows.find((r) => r.bodyRegion === "upper");
    expect(upper?.score).toBe(110);
  });

  test("does not skip persistence when incoming score regions are duplicated", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    const t = convexTest(schema, modules);
    const userId = await createUser(t);

    await t.mutation(internal.tonal.historySyncMutations.persistCurrentStrengthScores, {
      userId,
      scores: [
        { bodyRegion: "upper", score: 100 },
        { bodyRegion: "lower", score: 100 },
      ],
    });

    vi.setSystemTime(2000);
    await t.mutation(internal.tonal.historySyncMutations.persistCurrentStrengthScores, {
      userId,
      scores: [
        { bodyRegion: "upper", score: 100 },
        { bodyRegion: "upper", score: 100 },
      ],
    });

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("currentStrengthScores")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect(),
    );
    expect(rows.map((row) => row.fetchedAt).sort()).toEqual([2000, 2000]);
  });

  test("empty scores array deletes all existing", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);

    await t.mutation(internal.tonal.historySyncMutations.persistCurrentStrengthScores, {
      userId,
      scores: [{ bodyRegion: "upper", score: 100 }],
    });

    await t.mutation(internal.tonal.historySyncMutations.persistCurrentStrengthScores, {
      userId,
      scores: [],
    });

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("currentStrengthScores")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect(),
    );
    expect(rows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// persistMuscleReadiness
// ---------------------------------------------------------------------------

describe("persistMuscleReadiness", () => {
  test("inserts a readiness snapshot and skips unchanged rewrites", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000);
    const t = convexTest(schema, modules);
    const userId = await createUser(t);

    await t.mutation(internal.tonal.historySyncMutations.persistMuscleReadiness, {
      userId,
      readiness: baseReadiness,
    });

    const row = await t.run(async (ctx) =>
      ctx.db
        .query("muscleReadiness")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first(),
    );
    expect(row).not.toBeNull();
    expect(row?.chest).toBe(0.8);

    vi.setSystemTime(2000);
    await t.mutation(internal.tonal.historySyncMutations.persistMuscleReadiness, {
      userId,
      readiness: baseReadiness,
    });

    const after = await t.run(async (ctx) =>
      ctx.db
        .query("muscleReadiness")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first(),
    );
    expect(after?._id).toBe(row?._id);
    expect(after?.fetchedAt).toBe(1000);
  });

  test("second call replaces so only one row exists with new values", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);

    await t.mutation(internal.tonal.historySyncMutations.persistMuscleReadiness, {
      userId,
      readiness: baseReadiness,
    });

    const updated = { ...baseReadiness, chest: 0.95, quads: 0.3 };
    await t.mutation(internal.tonal.historySyncMutations.persistMuscleReadiness, {
      userId,
      readiness: updated,
    });

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("muscleReadiness")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect(),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].chest).toBe(0.95);
    expect(rows[0].quads).toBe(0.3);
  });
});
