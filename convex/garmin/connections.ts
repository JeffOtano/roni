import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import { rateLimiter } from "../rateLimits";

const disconnectReasonValidator = v.union(
  v.literal("user_disconnected"),
  v.literal("permission_revoked"),
  v.literal("token_invalid"),
);

/** OAuth request-token TTL. Garmin's authorize step is typically < 1m. */
const OAUTH_STATE_TTL_MS = 15 * 60 * 1000;

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
    return await ctx.db
      .query("garminConnections")
      .withIndex("by_garminUserId", (q) => q.eq("garminUserId", garminUserId))
      .unique();
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
