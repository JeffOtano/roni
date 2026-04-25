/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

type Harness = ReturnType<typeof convexTest>;

async function createUser(t: Harness): Promise<Id<"users">> {
  return t.run(async (ctx) => ctx.db.insert("users", {}));
}

async function insertGoal(
  t: Harness,
  userId: Id<"users">,
  title: string,
  status: "active" | "achieved" | "abandoned",
): Promise<Id<"goals">> {
  return t.run(async (ctx) =>
    ctx.db.insert("goals", {
      userId,
      title,
      category: "strength",
      metric: "bench_press",
      baselineValue: 100,
      targetValue: 120,
      currentValue: 100,
      deadline: "2026-12-31",
      status,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }),
  );
}

describe("goals.getAll", () => {
  test("returns goals newest-first regardless of status", async () => {
    // Spaced inserts give each row a distinct `_creationTime`. The query reads
    // through `by_userId_status`, which groups rows by status, so a
    // creation-time-desc result is only possible if the in-memory sort runs.
    const t = convexTest(schema, modules);
    const userId = await createUser(t);

    vi.useFakeTimers();
    try {
      vi.setSystemTime(1_000);
      const oldest = await insertGoal(t, userId, "oldest", "achieved");
      vi.setSystemTime(2_000);
      const middle = await insertGoal(t, userId, "middle", "active");
      vi.setSystemTime(3_000);
      const newest = await insertGoal(t, userId, "newest", "abandoned");

      const authed = t.withIdentity({ subject: `${userId}|session` });
      const result = await authed.query(api.goals.getAll, {});

      expect(result.map((g) => g._id)).toEqual([newest, middle, oldest]);
    } finally {
      vi.useRealTimers();
    }
  });

  test("isolates results to the authenticated user", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);
    const otherUserId = await createUser(t);

    await insertGoal(t, userId, "mine", "active");
    await insertGoal(t, otherUserId, "theirs", "active");

    const authed = t.withIdentity({ subject: `${userId}|session` });
    const result = await authed.query(api.goals.getAll, {});

    expect(result.map((g) => g.title)).toEqual(["mine"]);
  });
});
