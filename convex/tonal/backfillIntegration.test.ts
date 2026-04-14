/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
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

async function createProfile(
  t: ReturnType<typeof convexTest>,
  userId: Awaited<ReturnType<typeof createUser>>,
) {
  return t.run(async (ctx) =>
    ctx.db.insert("userProfiles", {
      userId,
      tonalUserId: "tonal-1",
      tonalToken: "token",
      lastActiveAt: Date.now(),
    }),
  );
}

// ---------------------------------------------------------------------------
// updateSyncStatus
// ---------------------------------------------------------------------------

describe("updateSyncStatus", () => {
  test("sets syncStatus on userProfiles", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);
    await createProfile(t, userId);

    await t.mutation(internal.userProfiles.updateSyncStatus, {
      userId,
      syncStatus: "syncing",
    });

    const profile = await t.run(async (ctx) =>
      ctx.db
        .query("userProfiles")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first(),
    );
    expect(profile?.syncStatus).toBe("syncing");
  });

  test("updates from syncing to complete", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);
    await createProfile(t, userId);

    await t.mutation(internal.userProfiles.updateSyncStatus, {
      userId,
      syncStatus: "syncing",
    });
    await t.mutation(internal.userProfiles.updateSyncStatus, {
      userId,
      syncStatus: "complete",
    });

    const profile = await t.run(async (ctx) =>
      ctx.db
        .query("userProfiles")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first(),
    );
    expect(profile?.syncStatus).toBe("complete");
  });

  test("updates from syncing to failed", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);
    await createProfile(t, userId);

    await t.mutation(internal.userProfiles.updateSyncStatus, {
      userId,
      syncStatus: "syncing",
    });
    await t.mutation(internal.userProfiles.updateSyncStatus, {
      userId,
      syncStatus: "failed",
    });

    const profile = await t.run(async (ctx) =>
      ctx.db
        .query("userProfiles")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first(),
    );
    expect(profile?.syncStatus).toBe("failed");
  });

  test("no-op when profile does not exist", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);
    // No profile created

    // Should not throw - no profile, mutation is a no-op
    await t.mutation(internal.userProfiles.updateSyncStatus, {
      userId,
      syncStatus: "syncing",
    });

    const profile = await t.run(async (ctx) =>
      ctx.db
        .query("userProfiles")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first(),
    );
    expect(profile).toBeNull();
  });
});
