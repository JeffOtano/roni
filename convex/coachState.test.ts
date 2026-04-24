/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

async function createUser(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => ctx.db.insert("users", {}));
}

describe("coachState", () => {
  test("upserts one materialized snapshot per user", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);

    await t.mutation(internal.coachState.upsertSnapshot, { userId, snapshot: "first" });
    await t.mutation(internal.coachState.upsertSnapshot, { userId, snapshot: "second" });

    const rows = await t.run(async (ctx) =>
      ctx.db
        .query("coachState")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect(),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].snapshot).toBe("second");
    expect(rows[0].lastError).toBeUndefined();
  });

  test("refresh failures preserve the previous snapshot", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);

    await t.mutation(internal.coachState.upsertSnapshot, { userId, snapshot: "usable" });
    await t.mutation(internal.coachState.recordRefreshFailure, { userId, error: "boom" });

    const row = await t.query(internal.coachState.getForUser, { userId });

    expect(row?.snapshot).toBe("usable");
    expect(row?.lastError).toBe("boom");
    expect(row?.failedAt).toBeTypeOf("number");
  });

  test("older refresh completions keep newer refresh requests pending", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);

    await t.run(async (ctx) =>
      ctx.db.insert("coachState", {
        userId,
        snapshot: "old",
        snapshotVersion: 1,
        refreshedAt: 50,
        refreshRequestedAt: 200,
        refreshRequestedTimezone: "America/New_York",
      }),
    );

    await t.mutation(internal.coachState.upsertSnapshot, {
      userId,
      snapshot: "built before newer write",
      requestedAt: 100,
    });

    const row = await t.query(internal.coachState.getForUser, { userId });

    expect(row?.snapshot).toBe("built before newer write");
    expect(row?.refreshedAt).toBe(0);
    expect(row?.refreshRequestedAt).toBe(200);
    expect(row?.refreshRequestedTimezone).toBe("America/New_York");
  });

  test("requestRefresh clears stale requested timezone when omitted", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);

    await t.mutation(internal.coachState.requestRefresh, {
      userId,
      userTimezone: "America/Los_Angeles",
    });
    await t.mutation(internal.coachState.requestRefresh, {
      userId,
      userTimezone: "America/New_York",
    });
    await t.mutation(internal.coachState.requestRefresh, { userId });

    const row = await t.query(internal.coachState.getForUser, { userId });

    expect(row?.refreshRequestedAt).toBeTypeOf("number");
    expect(row?.refreshRequestedTimezone).toBeNull();
  });
});
