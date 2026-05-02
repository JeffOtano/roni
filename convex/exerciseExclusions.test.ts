/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { register as registerRateLimiter } from "@convex-dev/rate-limiter/test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

function createTest() {
  const t = convexTest(schema, modules);
  registerRateLimiter(t);
  return t;
}

async function createUser(t: ReturnType<typeof convexTest>): Promise<Id<"users">> {
  return await t.run(async (ctx) => ctx.db.insert("users", {}));
}

async function insertMovement(
  t: ReturnType<typeof convexTest>,
  overrides: { tonalId: string; name: string; muscleGroups?: string[] },
): Promise<void> {
  await t.run(async (ctx) => {
    await ctx.db.insert("movements", {
      tonalId: overrides.tonalId,
      name: overrides.name,
      shortName: overrides.name,
      muscleGroups: overrides.muscleGroups ?? [],
      skillLevel: 1,
      publishState: "published",
      sortOrder: 0,
      onMachine: true,
      inFreeLift: false,
      countReps: true,
      isTwoSided: false,
      isBilateral: true,
      isAlternating: false,
      descriptionHow: "",
      descriptionWhy: "",
      lastSyncedAt: Date.now(),
    });
  });
}

describe("exerciseExclusions", () => {
  test("adds, lists, and removes an authenticated user's excluded exercise", async () => {
    const t = createTest();
    const userId = await createUser(t);
    const authed = t.withIdentity({ subject: `${userId}|session` });
    await insertMovement(t, {
      tonalId: "movement-bench",
      name: "Bench Press",
      muscleGroups: ["Chest", "Triceps"],
    });

    const added = await authed.mutation(api.exerciseExclusions.addMine, {
      movementId: "movement-bench",
    });
    const listed = await authed.query(api.exerciseExclusions.listMine, {});

    expect(added).toMatchObject({
      movementId: "movement-bench",
      movementName: "Bench Press",
      muscleGroups: ["Chest", "Triceps"],
    });
    expect(listed).toEqual([added]);

    await expect(
      authed.mutation(api.exerciseExclusions.removeMine, { movementId: "movement-bench" }),
    ).resolves.toEqual({ removed: true });
    await expect(authed.query(api.exerciseExclusions.listMine, {})).resolves.toEqual([]);
  });

  test("is idempotent when the same movement is added twice", async () => {
    const t = createTest();
    const userId = await createUser(t);
    const authed = t.withIdentity({ subject: `${userId}|session` });
    await insertMovement(t, { tonalId: "movement-row", name: "Seated Row" });

    const first = await authed.mutation(api.exerciseExclusions.addMine, {
      movementId: "movement-row",
    });
    const second = await authed.mutation(api.exerciseExclusions.addMine, {
      movementId: "movement-row",
    });
    const listed = await authed.query(api.exerciseExclusions.listMine, {});

    expect(second).toEqual(first);
    expect(listed).toHaveLength(1);
  });

  test("rejects unknown movement IDs", async () => {
    const t = createTest();
    const userId = await createUser(t);
    const authed = t.withIdentity({ subject: `${userId}|session` });

    await expect(
      authed.mutation(api.exerciseExclusions.addMine, { movementId: "missing" }),
    ).rejects.toThrow("Movement not found");
  });

  test("does not expose another user's exclusions", async () => {
    const t = createTest();
    const firstUserId = await createUser(t);
    const secondUserId = await createUser(t);
    const first = t.withIdentity({ subject: `${firstUserId}|session` });
    const second = t.withIdentity({ subject: `${secondUserId}|session` });
    await insertMovement(t, { tonalId: "movement-curl", name: "Bicep Curl" });

    await first.mutation(api.exerciseExclusions.addMine, { movementId: "movement-curl" });

    await expect(second.query(api.exerciseExclusions.listMine, {})).resolves.toEqual([]);
    await expect(
      second.mutation(api.exerciseExclusions.removeMine, { movementId: "movement-curl" }),
    ).resolves.toEqual({ removed: false });
  });

  test("internal query returns stored exclusions for programming paths", async () => {
    const t = createTest();
    const userId = await createUser(t);

    await t.run(async (ctx) => {
      await ctx.db.insert("exerciseExclusions", {
        userId,
        movementId: "movement-squat",
        movementName: "Squat",
        muscleGroups: ["Quads", "Glutes"],
        createdAt: 1000,
      });
    });

    const exclusions = await t.query(internal.exerciseExclusions.getForUser, { userId });

    expect(exclusions).toEqual([
      {
        movementId: "movement-squat",
        movementName: "Squat",
        muscleGroups: ["Quads", "Glutes"],
        createdAt: 1000,
      },
    ]);
  });
});
