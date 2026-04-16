import { v } from "convex/values";
import { internalQuery, mutation, query } from "./_generated/server";
import { components } from "./_generated/api";
import { getEffectiveUserId } from "./lib/auth";
import { listMessages } from "@convex-dev/agent";
import { CACHE_TTLS } from "./tonal/cache";

// ---------------------------------------------------------------------------
// Panel 2: Cache Inspector
// ---------------------------------------------------------------------------

export const listCacheEntries = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const entries = await ctx.db
      .query("tonalCache")
      .withIndex("by_userId_dataType", (q) => q.eq("userId", userId))
      .collect();

    const now = Date.now();
    return entries.map((entry) => ({
      _id: entry._id,
      dataType: entry.dataType,
      fetchedAt: entry.fetchedAt,
      expiresAt: entry.expiresAt,
      status: entry.expiresAt > now ? ("fresh" as const) : ("expired" as const),
      sizeBytes: JSON.stringify(entry.data).length,
      data: entry.data,
    }));
  },
});

export const deleteCacheEntry = mutation({
  args: { entryId: v.id("tonalCache") },
  handler: async (ctx, { entryId }) => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const entry = await ctx.db.get(entryId);
    if (!entry || entry.userId !== userId) {
      throw new Error("Cache entry not found or not owned by user");
    }
    await ctx.db.delete(entryId);
  },
});

export const purgeUserCache = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const entries = await ctx.db
      .query("tonalCache")
      .withIndex("by_userId_dataType", (q) => q.eq("userId", userId))
      .collect();

    for (const entry of entries) {
      await ctx.db.delete(entry._id);
    }
    return { deleted: entries.length };
  },
});

// ---------------------------------------------------------------------------
// Panel 3: Token Health
// ---------------------------------------------------------------------------

const TOKEN_REFRESH_LOCK_TTL_MS = 30 * 1000;

export const getTokenHealth = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    if (!profile) return null;

    const now = Date.now();
    const lockActive =
      profile.tokenRefreshInProgress != null &&
      now - profile.tokenRefreshInProgress < TOKEN_REFRESH_LOCK_TTL_MS;

    const health = await ctx.db
      .query("systemHealth")
      .withIndex("by_service", (q) => q.eq("service", "tonal"))
      .unique();

    return {
      tokenExpiresAt: profile.tonalTokenExpiresAt ?? null,
      hasRefreshToken: !!profile.tonalRefreshToken,
      refreshLockActive: lockActive,
      refreshLockTimestamp: profile.tokenRefreshInProgress ?? null,
      tonalConnectedAt: profile.tonalConnectedAt ?? null,
      lastActiveAt: profile.lastActiveAt,
      circuitOpen: health?.circuitOpen ?? false,
      circuitConsecutiveFailures: health?.consecutiveFailures ?? 0,
      circuitLastSuccessAt: health?.lastSuccessAt ?? null,
    };
  },
});

// ---------------------------------------------------------------------------
// Panel 4: Workout Push Debugger
// ---------------------------------------------------------------------------

export const getRecentPushes = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 20 }) => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const plans = await ctx.db
      .query("workoutPlans")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);

    return plans.map((plan) => ({
      _id: plan._id,
      title: plan.title,
      status: plan.status,
      createdAt: plan.createdAt,
      pushedAt: plan.pushedAt ?? null,
      pushErrorReason: plan.pushErrorReason ?? null,
      tonalWorkoutId: plan.tonalWorkoutId ?? null,
      blocks: plan.blocks,
      estimatedDuration: plan.estimatedDuration ?? null,
    }));
  },
});

// ---------------------------------------------------------------------------
// Panel 5: Agent Tool Trace
// ---------------------------------------------------------------------------

export const listUserThreads = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 20 }) => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const threads = await ctx.runQuery(components.agent.threads.listThreadsByUserId, {
      userId: userId as string,
      paginationOpts: { cursor: null, numItems: limit },
      order: "desc",
    });

    return threads.page
      .filter((t) => t.status === "active")
      .map((t) => ({
        threadId: t._id,
        createdAt: t._creationTime,
      }));
  },
});

export const listThreadMessages = query({
  args: { threadId: v.string() },
  handler: async (ctx, { threadId }) => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const threads = await ctx.runQuery(components.agent.threads.listThreadsByUserId, {
      userId: userId as string,
      paginationOpts: { cursor: null, numItems: 50 },
      order: "desc",
    });
    const ownsThread = threads.page.some((t) => t._id === threadId);
    if (!ownsThread) throw new Error("Thread not found or not owned by user");

    const result = await listMessages(ctx, components.agent, {
      threadId,
      paginationOpts: { cursor: null, numItems: 100 },
      excludeToolMessages: false,
    });

    return result.page;
  },
});

export const getCacheTTLs = query({
  args: {},
  handler: async () => {
    return CACHE_TTLS;
  },
});

// ---------------------------------------------------------------------------
// Internal queries (used by devToolsActions.ts)
// ---------------------------------------------------------------------------

export const getPlanForReconstruction = internalQuery({
  args: {
    planId: v.id("workoutPlans"),
    userId: v.id("users"),
  },
  handler: async (ctx, { planId, userId }) => {
    const plan = await ctx.db.get(planId);
    if (!plan || plan.userId !== userId) return null;
    return { title: plan.title, blocks: plan.blocks };
  },
});
