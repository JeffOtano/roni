import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "../_generated/server";
import { getEffectiveUserId } from "../lib/auth";
import { rateLimiter } from "../rateLimits";

const disconnectReasonValidator = v.union(
  v.literal("user_disconnected"),
  v.literal("permission_revoked"),
  v.literal("token_invalid"),
);

/** OAuth request-token TTL. Garmin's authorize step is typically < 1m. */
const OAUTH_STATE_TTL_MS = 15 * 60 * 1000;

// ---------------------------------------------------------------------------
// Public surface for the settings UI
// ---------------------------------------------------------------------------

export type GarminConnectionStatus =
  | { state: "none" }
  | {
      state: "active";
      garminUserId: string;
      connectedAt: number;
      permissions: readonly string[];
    }
  | {
      state: "disconnected";
      disconnectedAt: number;
      reason?: "user_disconnected" | "permission_revoked" | "token_invalid";
    };

export const getMyGarminStatus = query({
  args: {},
  handler: async (ctx): Promise<GarminConnectionStatus> => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) return { state: "none" };

    const row = await ctx.db
      .query("garminConnections")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!row) return { state: "none" };

    if (row.status === "active") {
      return {
        state: "active",
        garminUserId: row.garminUserId,
        connectedAt: row.connectedAt,
        permissions: row.permissions,
      };
    }

    return {
      state: "disconnected",
      disconnectedAt: row.disconnectedAt ?? row._creationTime,
      reason: row.disconnectReason,
    };
  },
});

export const getActiveConnectionByUserId = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const row = await ctx.db
      .query("garminConnections")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    return row?.status === "active" ? row : null;
  },
});

export const getByGarminUserId = internalQuery({
  args: { garminUserId: v.string() },
  handler: async (ctx, { garminUserId }) => {
    const rows = await ctx.db
      .query("garminConnections")
      .withIndex("by_garminUserId_status", (q) =>
        q.eq("garminUserId", garminUserId).eq("status", "active"),
      )
      .take(2);
    if (rows.length > 1) {
      console.error("[garmin] duplicate active connections for Garmin user", {
        garminUserId,
        connectionIds: rows.map((row) => row._id),
        userIds: rows.map((row) => row.userId),
      });
    }
    return rows.length === 1 ? rows[0] : null;
  },
});

export const upsertConnection = internalMutation({
  args: {
    userId: v.id("users"),
    garminUserId: v.string(),
    accessTokenEncrypted: v.string(),
    accessTokenSecretEncrypted: v.string(),
    permissions: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const activeRowsForGarminUser = await ctx.db
      .query("garminConnections")
      .withIndex("by_garminUserId_status", (q) =>
        q.eq("garminUserId", args.garminUserId).eq("status", "active"),
      )
      .take(2);
    if (activeRowsForGarminUser.some((row) => row.userId !== args.userId)) {
      throw new Error("This Garmin account is already connected to another Roni account");
    }

    const existing = await ctx.db
      .query("garminConnections")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();
    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        garminUserId: args.garminUserId,
        accessTokenEncrypted: args.accessTokenEncrypted,
        accessTokenSecretEncrypted: args.accessTokenSecretEncrypted,
        permissions: args.permissions,
        permissionsRefreshedAt: now,
        disconnectedAt: undefined,
        disconnectReason: undefined,
        status: "active",
      });
      return existing._id;
    }

    return await ctx.db.insert("garminConnections", {
      ...args,
      connectedAt: now,
      permissionsRefreshedAt: now,
      status: "active",
    });
  },
});

export const markDisconnected = internalMutation({
  args: {
    userId: v.id("users"),
    reason: disconnectReasonValidator,
  },
  handler: async (ctx, { userId, reason }) => {
    const existing = await ctx.db
      .query("garminConnections")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!existing || existing.status === "disconnected") return;
    await ctx.db.patch(existing._id, {
      status: "disconnected",
      disconnectedAt: Date.now(),
      disconnectReason: reason,
    });
  },
});

export const refreshPermissions = internalMutation({
  args: {
    userId: v.id("users"),
    permissions: v.array(v.string()),
  },
  handler: async (ctx, { userId, permissions }) => {
    const existing = await ctx.db
      .query("garminConnections")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (!existing) return;
    if (existing.status === "disconnected") {
      console.warn("[garmin] skipping permission refresh for disconnected connection", {
        connectionId: existing._id,
        userId,
      });
      return;
    }
    await ctx.db.patch(existing._id, {
      permissions,
      permissionsRefreshedAt: Date.now(),
    });
  },
});

// ---------------------------------------------------------------------------
// Short-lived OAuth 1.0a request-token state (one row per in-flight handshake)
// ---------------------------------------------------------------------------

/**
 * Rate-limit guard called by `startGarminOAuth` before any network call
 * to Garmin. Consumes a token from the per-user bucket; throws on refill
 * exhaustion so the action returns a useful error instead of burning
 * partner quota.
 */
export const acquireOauthStartSlot = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await rateLimiter.limit(ctx, "startGarminOAuth", { key: userId, throws: true });
  },
});

export const acquireBackfillSlot = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await rateLimiter.limit(ctx, "backfillGarminData", { key: userId, throws: true });
  },
});

export const saveOauthState = internalMutation({
  args: {
    userId: v.id("users"),
    requestToken: v.string(),
    requestTokenSecretEncrypted: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("garminOauthStates", {
      userId: args.userId,
      requestToken: args.requestToken,
      requestTokenSecretEncrypted: args.requestTokenSecretEncrypted,
      createdAt: now,
      expiresAt: now + OAUTH_STATE_TTL_MS,
    });
  },
});

export const claimOauthState = internalMutation({
  args: { requestToken: v.string() },
  handler: async (ctx, { requestToken }) => {
    const row = await ctx.db
      .query("garminOauthStates")
      .withIndex("by_requestToken", (q) => q.eq("requestToken", requestToken))
      .unique();
    if (!row) return null;
    if (row.consumedAt) return null;
    if (row.expiresAt < Date.now()) return null;
    await ctx.db.patch(row._id, { consumedAt: Date.now() });
    return {
      userId: row.userId,
      requestTokenSecretEncrypted: row.requestTokenSecretEncrypted,
    };
  },
});

export const sweepExpiredOauthStates = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const expired = await ctx.db
      .query("garminOauthStates")
      .withIndex("by_expiresAt", (q) => q.lt("expiresAt", now))
      .take(200);
    for (const row of expired) {
      await ctx.db.delete(row._id);
    }
    return expired.length;
  },
});
