/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";

// Vite normalizes same-directory glob keys to "./foo.ts" instead of
// "../garmin/foo.ts", which breaks convex-test module resolution.
// Remap ./foo.ts -> ../garmin/foo.ts to match the expected path format.
const rawModules = import.meta.glob("../**/*.*s");
const modules: typeof rawModules = {};
for (const [key, value] of Object.entries(rawModules)) {
  modules[key.startsWith("./") ? "../garmin/" + key.slice(2) : key] = value;
}

async function createUser(t: ReturnType<typeof convexTest>): Promise<Id<"users">> {
  return await t.run(async (ctx) => ctx.db.insert("users", {}));
}

async function connectGarminUser(
  t: ReturnType<typeof convexTest>,
  userId: Id<"users">,
  garminUserId = "garmin-user-1",
) {
  return await t.mutation(internal.garmin.connections.upsertConnection, {
    userId,
    garminUserId,
    accessTokenEncrypted: `token-${userId}`,
    accessTokenSecretEncrypted: `secret-${userId}`,
    permissions: ["ACTIVITY_EXPORT"],
  });
}

describe("garmin connections", () => {
  it("looks up only active connections by Garmin user id", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);
    await connectGarminUser(t, userId);

    await t.mutation(internal.garmin.connections.markDisconnected, {
      userId,
      reason: "user_disconnected",
    });

    await expect(
      t.query(internal.garmin.connections.getByGarminUserId, {
        garminUserId: "garmin-user-1",
      }),
    ).resolves.toBeNull();
  });

  it("rejects linking one active Garmin account to two Roni users", async () => {
    const t = convexTest(schema, modules);
    const firstUserId = await createUser(t);
    const secondUserId = await createUser(t);
    await connectGarminUser(t, firstUserId);

    await expect(connectGarminUser(t, secondUserId)).rejects.toThrow(
      "This Garmin account is already connected to another Roni account",
    );
  });

  it("does not refresh permissions on disconnected connections", async () => {
    const t = convexTest(schema, modules);
    const userId = await createUser(t);
    await connectGarminUser(t, userId);

    await t.mutation(internal.garmin.connections.markDisconnected, {
      userId,
      reason: "user_disconnected",
    });
    await t.mutation(internal.garmin.connections.refreshPermissions, {
      userId,
      permissions: ["HEALTH_EXPORT"],
    });

    const row = await t.run(async (ctx) =>
      ctx.db
        .query("garminConnections")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .unique(),
    );
    expect(row?.status).toBe("disconnected");
    expect(row?.permissions).toEqual(["ACTIVITY_EXPORT"]);
  });
});
