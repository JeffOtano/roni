import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { internalQuery, mutation, query } from "./_generated/server";
import { components } from "./_generated/api";
import { getEffectiveUserId } from "./lib/auth";
import { listMessages } from "@convex-dev/agent";

// ---------------------------------------------------------------------------
// Panel 2: Cache Inspector
// ---------------------------------------------------------------------------

// Each tonalCache row can hold up to ~1 MiB (Convex doc size cap). Heavy users
// accumulate 15+ entries (workoutPage:N backfill pages, workoutHistory_v3,
// strengthHistory, customWorkouts, ...). A page size of 10 keeps per-call
// bytes-read comfortably under Convex's 16 MiB function limit.
const CACHE_PAGE_SIZE = 10;
const CACHE_PURGE_BATCH_SIZE = 10;

export const listCacheEntries = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const result = await ctx.db
      .query("tonalCache")
      .withIndex("by_userId_dataType", (q) => q.eq("userId", userId))
      .paginate({ ...paginationOpts, numItems: CACHE_PAGE_SIZE });

    const now = Date.now();
    return {
      ...result,
      page: result.page.map((entry) => ({
        _id: entry._id,
        dataType: entry.dataType,
        fetchedAt: entry.fetchedAt,
        expiresAt: entry.expiresAt,
        status: entry.expiresAt > now ? ("fresh" as const) : ("expired" as const),
        sizeBytes: JSON.stringify(entry.data).length,
      })),
    };
  },
});

export const getCacheEntryData = query({
  args: { entryId: v.id("tonalCache") },
  handler: async (ctx, { entryId }) => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const entry = await ctx.db.get(entryId);
    if (!entry) return null;
    if (entry.userId !== userId) {
      throw new Error("Cache entry not owned by user");
    }
    return { data: entry.data };
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

/** Delete one batch of the caller's tonalCache rows. Returns `hasMore` so the
 *  UI can drain large caches without exceeding Convex's per-call read limit. */
export const purgeUserCacheBatch = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const entries = await ctx.db
      .query("tonalCache")
      .withIndex("by_userId_dataType", (q) => q.eq("userId", userId))
      .take(CACHE_PURGE_BATCH_SIZE);

    for (const entry of entries) {
      await ctx.db.delete(entry._id);
    }
    return { deleted: entries.length, hasMore: entries.length === CACHE_PURGE_BATCH_SIZE };
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

    return {
      tokenExpiresAt: profile.tonalTokenExpiresAt ?? null,
      hasRefreshToken: !!profile.tonalRefreshToken,
      refreshLockActive: lockActive,
      refreshLockTimestamp: profile.tokenRefreshInProgress ?? null,
      tonalConnectedAt: profile.tonalConnectedAt ?? null,
      lastActiveAt: profile.lastActiveAt,
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

    const safeLimit = Math.min(limit, 100);
    const plans = await ctx.db
      .query("workoutPlans")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .order("desc")
      .take(safeLimit);

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

    const safeLimit = Math.min(limit, 50);
    const threads = await ctx.runQuery(components.agent.threads.listThreadsByUserId, {
      userId: userId as string,
      paginationOpts: { cursor: null, numItems: safeLimit },
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
