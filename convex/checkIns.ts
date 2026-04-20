import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import {
  type ActionCtx,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { getEffectiveUserId } from "./lib/auth";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { getMessageForTrigger } from "./checkIns/content";
import * as analytics from "./lib/posthog";

const triggerValidator = v.union(
  v.literal("missed_session"),
  v.literal("gap_3_days"),
  v.literal("tough_session_completed"),
  v.literal("weekly_recap"),
  v.literal("strength_milestone"),
  v.literal("plateau"),
  v.literal("high_external_load"),
  v.literal("consistency_streak"),
);

const frequencyValidator = v.union(
  v.literal("daily"),
  v.literal("every_other_day"),
  v.literal("weekly"),
);

const DEFAULT_PREFS = {
  enabled: true,
  frequency: "daily" as const,
  muted: false,
};

export const getPreferences = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) return null;

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    return {
      ...(profile?.checkInPreferences ?? DEFAULT_PREFS),
      readAllBeforeAt: profile?.checkInsReadAllBeforeAt,
    };
  },
});

export const updatePreferences = mutation({
  args: {
    enabled: v.optional(v.boolean()),
    frequency: v.optional(frequencyValidator),
    muted: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    if (!profile) throw new Error("User profile not found");

    const current = profile.checkInPreferences ?? DEFAULT_PREFS;
    const next = {
      enabled: args.enabled ?? current.enabled,
      frequency: args.frequency ?? current.frequency,
      muted: args.muted ?? current.muted,
    };

    await ctx.db.patch(profile._id, { checkInPreferences: next });
  },
});

export const listUnread = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) return [];

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    const readAllBeforeAt = profile?.checkInsReadAllBeforeAt ?? 0;

    const all = await ctx.db
      .query("checkIns")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", userId))
      .collect();
    return all
      .filter((c) => c.readAt === undefined && c.createdAt > readAllBeforeAt)
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) return [];

    return await ctx.db
      .query("checkIns")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", userId))
      .order("desc")
      .take(50);
  },
});

export const markRead = mutation({
  args: { checkInId: v.id("checkIns") },
  handler: async (ctx, { checkInId }) => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const row = await ctx.db.get(checkInId);
    if (!row || row.userId !== userId) throw new Error("Check-in not found");
    if (row.readAt !== undefined) return;

    await ctx.db.patch(checkInId, { readAt: Date.now() });
  },
});

export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    if (!profile) throw new Error("User profile not found");

    await ctx.db.patch(profile._id, {
      checkInsReadAllBeforeAt: Date.now(),
    });
  },
});

export const createCheckIn = internalMutation({
  args: {
    userId: v.id("users"),
    trigger: triggerValidator,
    message: v.string(),
    triggerContext: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("checkIns", {
      userId: args.userId,
      trigger: args.trigger,
      message: args.message,
      triggerContext: args.triggerContext,
      createdAt: Date.now(),
    });
  },
});

export const hasRecentCheckIn = internalQuery({
  args: {
    userId: v.id("users"),
    trigger: triggerValidator,
    since: v.number(),
    triggerContext: v.optional(v.string()),
  },
  handler: async (ctx, { userId, trigger, since, triggerContext }) => {
    const recent = await ctx.db
      .query("checkIns")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
    return recent.some(
      (c) =>
        c.trigger === trigger &&
        c.createdAt >= since &&
        (triggerContext === undefined || c.triggerContext === triggerContext),
    );
  },
});

/**
 * One page of user IDs eligible for check-ins (enabled + not muted).
 * The filter lives on a nested object (`checkInPreferences.enabled`) that
 * no index can cover, so we paginate the full table and filter per page.
 */
export const getEligibleUserIdsPage = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    const result = await ctx.db.query("userProfiles").paginate(paginationOpts);
    return {
      ...result,
      page: result.page
        .filter((p) => {
          const prefs = p.checkInPreferences ?? DEFAULT_PREFS;
          return prefs.enabled && !prefs.muted;
        })
        .map((p) => p.userId),
    };
  },
});

export const getPreferencesInternal = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    return profile?.checkInPreferences ?? DEFAULT_PREFS;
  },
});

export const getLastCheckInCreatedAt = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const recent = await ctx.db
      .query("checkIns")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", userId))
      .order("desc")
      .first();
    return recent?.createdAt;
  },
});

function frequencyWindowMs(frequency: "daily" | "every_other_day" | "weekly"): number {
  switch (frequency) {
    case "daily":
      return 24 * 60 * 60 * 1000;
    case "every_other_day":
      return 2 * 24 * 60 * 60 * 1000;
    case "weekly":
      return 7 * 24 * 60 * 60 * 1000;
  }
}

async function evaluateUserCheckIn(
  ctx: ActionCtx,
  userId: Id<"users">,
  now: number,
): Promise<number> {
  const [prefs, lastCreatedAt] = await Promise.all([
    ctx.runQuery(internal.checkIns.getPreferencesInternal, { userId }),
    ctx.runQuery(internal.checkIns.getLastCheckInCreatedAt, { userId }),
  ]);
  const window = frequencyWindowMs(prefs.frequency);
  if (lastCreatedAt != null && now - lastCreatedAt < window) return 0;

  const toSend = await ctx.runAction(internal.checkIns.triggers.evaluateTriggersForUser, {
    userId,
  });
  for (const { trigger, triggerContext, message: customMessage } of toSend) {
    const message = customMessage ?? getMessageForTrigger(trigger);
    await ctx.runMutation(internal.checkIns.createCheckIn, {
      userId,
      trigger,
      message,
      triggerContext,
    });
    analytics.capture(userId, "check_in_received", { trigger });
  }
  return toSend.length;
}

const ELIGIBLE_USERS_PAGE_SIZE = 100;

export const runCheckInTriggerEvaluation = internalAction({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const BATCH_SIZE = 5;
    const DELAY_MS = 2000;
    let checkInsSent = 0;
    let totalEligible = 0;

    let cursor: string | null = null;
    while (true) {
      const result: { page: Id<"users">[]; isDone: boolean; continueCursor: string } =
        await ctx.runQuery(internal.checkIns.getEligibleUserIdsPage, {
          paginationOpts: { cursor, numItems: ELIGIBLE_USERS_PAGE_SIZE },
        });

      for (let i = 0; i < result.page.length; i += BATCH_SIZE) {
        const batch = result.page.slice(i, i + BATCH_SIZE);
        const outcomes = await Promise.allSettled(
          batch.map((userId) => evaluateUserCheckIn(ctx, userId, now)),
        );
        for (let j = 0; j < outcomes.length; j++) {
          const outcome = outcomes[j];
          const userId = batch[j];
          if (outcome.status === "fulfilled") {
            checkInsSent += outcome.value;
          } else {
            const err = outcome.reason;
            console.error("[check-in] evaluateTriggersForUser failed", {
              userId,
              error: err instanceof Error ? err.message : String(err),
            });
            ctx
              .runAction(internal.discord.notifyError, {
                source: "checkIns",
                message: `Trigger evaluation failed: ${err instanceof Error ? err.message : String(err)}`,
                userId,
              })
              .catch((notifyErr: unknown) =>
                console.warn("[check-in] discord notify failed", notifyErr),
              );
          }
        }
        if (i + BATCH_SIZE < result.page.length) {
          await new Promise((r) => setTimeout(r, DELAY_MS));
        }
      }

      totalEligible += result.page.length;
      if (result.isDone) break;
      cursor = result.continueCursor;
    }

    analytics.captureSystem("check_in_trigger_evaluated", {
      users_checked: totalEligible,
      check_ins_sent: checkInsSent,
    });
    await analytics.flush();
  },
});
