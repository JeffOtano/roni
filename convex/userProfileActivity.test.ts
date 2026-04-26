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

type TestHarness = ReturnType<typeof createTest>;

async function createUser(t: TestHarness): Promise<Id<"users">> {
  return t.run(async (ctx) => ctx.db.insert("users", {}));
}

async function createProfile(t: TestHarness, userId: Id<"users">) {
  return t.run(async (ctx) =>
    ctx.db.insert("userProfiles", {
      userId,
      tonalUserId: `tonal-${userId}`,
      tonalToken: "token",
      lastActiveAt: 1_000,
    }),
  );
}

async function readActivity(t: TestHarness, userId: Id<"users">) {
  return t.run(async (ctx) =>
    ctx.db
      .query("userProfileActivity")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique(),
  );
}

describe("userProfileActivity dual-write", () => {
  test("recordAppActivity writes to both userProfiles and userProfileActivity", async () => {
    const t = createTest();
    const userId = await createUser(t);
    await createProfile(t, userId);
    const authed = t.withIdentity({ subject: `${userId}|session` });

    await authed.mutation(api.userActivity.recordAppActivity, {});

    const activity = await readActivity(t, userId);
    expect(activity?.lastActiveAt).toBeGreaterThan(0);
    expect(activity?.appLastActiveAt).toBeGreaterThan(0);
  });

  test("updateSyncStatus writes to both tables", async () => {
    const t = createTest();
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
    const activity = await readActivity(t, userId);
    expect(profile?.syncStatus).toBe("syncing");
    expect(activity?.syncStatus).toBe("syncing");
  });

  test("token refresh lock acquire/release dual-writes", async () => {
    const t = createTest();
    const userId = await createUser(t);
    await createProfile(t, userId);

    const acquired = await t.mutation(internal.userProfiles.acquireTokenRefreshLock, { userId });
    expect(acquired).toBe(true);
    const acquiredActivity = await readActivity(t, userId);
    expect(acquiredActivity?.tokenRefreshInProgress).toBeGreaterThan(0);

    await t.mutation(internal.userProfiles.releaseTokenRefreshLock, { userId });
    const releasedActivity = await readActivity(t, userId);
    expect(releasedActivity?.tokenRefreshInProgress).toBeUndefined();
  });

  test("updateLastSyncedActivityDate dual-writes", async () => {
    const t = createTest();
    const userId = await createUser(t);
    await createProfile(t, userId);

    await t.mutation(internal.userProfiles.updateLastSyncedActivityDate, {
      userId,
      date: "2026-04-25",
    });

    const activity = await readActivity(t, userId);
    expect(activity?.lastSyncedActivityDate).toBe("2026-04-25");
  });

  test("activity row is created on first dual-write when none exists", async () => {
    const t = createTest();
    const userId = await createUser(t);
    await createProfile(t, userId);

    expect(await readActivity(t, userId)).toBeNull();

    await t.mutation(internal.userProfiles.updateSyncStatus, {
      userId,
      syncStatus: "complete",
    });

    const activity = await readActivity(t, userId);
    expect(activity?.syncStatus).toBe("complete");
  });

  test("create dual-writes activity timestamps on first connect", async () => {
    const t = createTest();
    const userId = await createUser(t);

    await t.mutation(internal.userProfiles.create, {
      userId,
      tonalUserId: "tonal-1",
      tonalToken: "token",
    });

    const activity = await readActivity(t, userId);
    expect(activity?.lastActiveAt).toBeGreaterThan(0);
    expect(activity?.appLastActiveAt).toBeGreaterThan(0);
  });

  test("create dual-writes activity timestamps on reconnect of existing profile", async () => {
    const t = createTest();
    const userId = await createUser(t);
    await t.run(async (ctx) =>
      ctx.db.insert("userProfiles", {
        userId,
        tonalUserId: "tonal-1",
        tonalToken: "stale",
        lastActiveAt: 1_000,
        appLastActiveAt: 1_000,
      }),
    );

    await t.mutation(internal.userProfiles.create, {
      userId,
      tonalUserId: "tonal-1",
      tonalToken: "fresh",
    });

    const activity = await readActivity(t, userId);
    expect(activity?.lastActiveAt).toBeGreaterThan(1_000);
    expect(activity?.appLastActiveAt).toBeGreaterThan(1_000);
  });

  test("triggerBackfillIfNeeded dual-writes syncStatus", async () => {
    const t = createTest();
    const userId = await createUser(t);
    await createProfile(t, userId);
    const authed = t.withIdentity({ subject: `${userId}|session` });

    await authed.mutation(api.dashboard.triggerBackfillIfNeeded, {});

    const profile = await t.run(async (ctx) =>
      ctx.db
        .query("userProfiles")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first(),
    );
    const activity = await readActivity(t, userId);
    expect(profile?.syncStatus).toBe("syncing");
    expect(activity?.syncStatus).toBe("syncing");
  });

  test("acquireTokenRefreshLock does not re-stamp activity when lock is held", async () => {
    const t = createTest();
    const userId = await createUser(t);
    await createProfile(t, userId);

    expect(await t.mutation(internal.userProfiles.acquireTokenRefreshLock, { userId })).toBe(true);
    const firstStamp = (await readActivity(t, userId))?.tokenRefreshInProgress;
    expect(firstStamp).toBeGreaterThan(0);

    expect(await t.mutation(internal.userProfiles.acquireTokenRefreshLock, { userId })).toBe(false);
    const secondStamp = (await readActivity(t, userId))?.tokenRefreshInProgress;
    expect(secondStamp).toBe(firstStamp);
  });
});

describe("getSyncStatus query", () => {
  test("reads from userProfileActivity when present", async () => {
    const t = createTest();
    const userId = await createUser(t);
    await createProfile(t, userId);
    const authed = t.withIdentity({ subject: `${userId}|session` });

    await t.mutation(internal.userProfiles.updateSyncStatus, {
      userId,
      syncStatus: "syncing",
    });

    const status = await authed.query(api.users.getSyncStatus, {});
    expect(status).toBe("syncing");
  });

  test("falls back to userProfiles for non-backfilled rows", async () => {
    const t = createTest();
    const userId = await createUser(t);
    await t.run(async (ctx) =>
      ctx.db.insert("userProfiles", {
        userId,
        tonalUserId: `tonal-${userId}`,
        tonalToken: "token",
        lastActiveAt: 1_000,
        syncStatus: "failed",
      }),
    );
    const authed = t.withIdentity({ subject: `${userId}|session` });

    expect(await readActivity(t, userId)).toBeNull();

    const status = await authed.query(api.users.getSyncStatus, {});
    expect(status).toBe("failed");
  });

  test("falls back to userProfiles when activity row exists without syncStatus", async () => {
    // Realistic mid-rollout state: legacy user with syncStatus on userProfiles
    // opens the app once. recordAppActivity creates an activity row holding
    // only timestamps. getSyncStatus must still surface the legacy status.
    const t = createTest();
    const userId = await createUser(t);
    await t.run(async (ctx) =>
      ctx.db.insert("userProfiles", {
        userId,
        tonalUserId: `tonal-${userId}`,
        tonalToken: "token",
        lastActiveAt: 1_000,
        syncStatus: "syncing",
      }),
    );
    const authed = t.withIdentity({ subject: `${userId}|session` });
    await authed.mutation(api.userActivity.recordAppActivity, {});

    const activity = await readActivity(t, userId);
    expect(activity).not.toBeNull();
    expect(activity?.syncStatus).toBeUndefined();

    const status = await authed.query(api.users.getSyncStatus, {});
    expect(status).toBe("syncing");
  });

  test("returns null for unauthenticated requests", async () => {
    const t = createTest();
    const status = await t.query(api.users.getSyncStatus, {});
    expect(status).toBeNull();
  });
});
