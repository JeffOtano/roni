/**
 * Raw Garmin Push webhook event log + status transitions. Every Push
 * payload lands here first so we can:
 *   - replay after fixing normalizer bugs without relying on Garmin's
 *     24-hour retry window
 *   - audit "my data didn't sync" support questions
 *   - diff Garmin's resend payloads when a summary is revised
 *
 * Rows auto-expire after WEBHOOK_EVENT_TTL_MS via a periodic sweeper.
 */

import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

export const WEBHOOK_EVENT_TTL_MS = 14 * 24 * 60 * 60 * 1000;

const statusValidator = v.union(
  v.literal("received"),
  v.literal("processed"),
  v.literal("rejected"),
  v.literal("error"),
);

export const recordReceived = internalMutation({
  args: {
    eventType: v.string(),
    garminUserId: v.optional(v.string()),
    userId: v.optional(v.id("users")),
    rawPayload: v.any(),
  },
  handler: async (ctx, args): Promise<Id<"garminWebhookEvents">> => {
    const now = Date.now();
    return await ctx.db.insert("garminWebhookEvents", {
      eventType: args.eventType,
      garminUserId: args.garminUserId,
      userId: args.userId,
      rawPayload: args.rawPayload,
      status: "received",
      receivedAt: now,
      expiresAt: now + WEBHOOK_EVENT_TTL_MS,
    });
  },
});

export const updateStatus = internalMutation({
  args: {
    eventId: v.id("garminWebhookEvents"),
    status: statusValidator,
    errorReason: v.optional(v.string()),
    userId: v.optional(v.id("users")),
  },
  handler: async (ctx, { eventId, status, errorReason, userId }) => {
    await ctx.db.patch(eventId, {
      status,
      errorReason: status === "processed" ? undefined : errorReason,
      ...(userId !== undefined ? { userId } : {}),
    });
  },
});

export const sweepExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const expired = await ctx.db
      .query("garminWebhookEvents")
      .withIndex("by_expiresAt", (q) => q.lt("expiresAt", now))
      .take(200);
    for (const row of expired) {
      await ctx.db.delete(row._id);
    }
    return expired.length;
  },
});
