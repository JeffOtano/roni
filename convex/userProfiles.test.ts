/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");
const THIRTY_MINUTES_MS = 30 * 60 * 1000;

async function createUser(t: ReturnType<typeof convexTest>): Promise<Id<"users">> {
  return t.run(async (ctx) => ctx.db.insert("users", {}));
}

async function createProfile(
  t: ReturnType<typeof convexTest>,
  userId: Id<"users">,
  overrides: Partial<{
    lastActiveAt: number;
    appLastActiveAt: number;
    tonalTokenExpiresAt: number;
  }> = {},
) {
  return t.run(async (ctx) =>
    ctx.db.insert("userProfiles", {
      userId,
      tonalUserId: `tonal-${userId}`,
      tonalToken: "token",
      lastActiveAt: 1000,
      ...overrides,
    }),
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe("user activity tracking", () => {
  test("uses app activity instead of background token freshness", async () => {
    const t = convexTest(schema, modules);
    const activeUserId = await createUser(t);
    const tokenOnlyUserId = await createUser(t);
    const legacyUserId = await createUser(t);

    await createProfile(t, activeUserId, { lastActiveAt: 9000, appLastActiveAt: 9000 });
    await createProfile(t, tokenOnlyUserId, { lastActiveAt: 9000, appLastActiveAt: 1000 });
    await createProfile(t, legacyUserId, { lastActiveAt: 9000 });

    const activeUsers = await t.query(internal.userActivity.getActiveUsers, {
      sinceTimestamp: 5000,
    });

    expect(activeUsers.map((profile) => profile.userId)).toEqual([activeUserId]);
  });

  test("token refresh does not update app activity", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);
    const profileId = await createProfile(t, userId, {
      lastActiveAt: 1000,
      appLastActiveAt: 2000,
      tonalTokenExpiresAt: 3000,
    });

    await t.mutation(internal.userProfiles.updateTonalToken, {
      userId,
      tonalToken: "fresh-token",
      tonalTokenExpiresAt: 4000,
    });

    const profile = await t.run(async (ctx) => ctx.db.get(profileId));

    expect(profile?.lastActiveAt).toBe(1000);
    expect(profile?.appLastActiveAt).toBe(2000);
  });

  test("recordAppActivity requires authentication", async () => {
    const t = convexTest(schema, modules);

    await expect(t.mutation(api.userActivity.recordAppActivity, {})).rejects.toThrow(
      "Not authenticated",
    );
  });

  test("recordAppActivity throttles writes and updates both activity timestamps", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
    const t = convexTest(schema, modules);
    const userId = await createUser(t);
    const profileId = await createProfile(t, userId, {
      lastActiveAt: 10_000,
      appLastActiveAt: 10_000,
    });
    const authed = t.withIdentity({ subject: `${userId}|session` });

    vi.setSystemTime(10_000 + THIRTY_MINUTES_MS - 1);
    await authed.mutation(api.userActivity.recordAppActivity, {});

    const throttled = await t.run(async (ctx) => ctx.db.get(profileId));
    expect(throttled?.lastActiveAt).toBe(10_000);
    expect(throttled?.appLastActiveAt).toBe(10_000);

    vi.setSystemTime(10_000 + THIRTY_MINUTES_MS);
    await authed.mutation(api.userActivity.recordAppActivity, {});

    const updated = await t.run(async (ctx) => ctx.db.get(profileId));
    expect(updated?.lastActiveAt).toBe(10_000 + THIRTY_MINUTES_MS);
    expect(updated?.appLastActiveAt).toBe(10_000 + THIRTY_MINUTES_MS);
  });

  test("recordAppActivity is a no-op before a Tonal profile exists", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);
    const authed = t.withIdentity({ subject: `${userId}|session` });

    await authed.mutation(api.userActivity.recordAppActivity, {});

    const profiles = await t.run(async (ctx) =>
      ctx.db
        .query("userProfiles")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .collect(),
    );
    expect(profiles).toHaveLength(0);
  });
});
