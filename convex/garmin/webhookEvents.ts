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
    /**
     * Raw JSON body as received from Garmin. Stored verbatim as a
     * string so we survive the 1024-fields-per-object Convex arg/doc
     * limit (e.g. dailies payloads pack thousands of HR samples into
     * `timeOffsetHeartRateSamples`). Replay consumers JSON.parse it.
     */
    rawPayload: v.string(),
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
    // Persist whatever the caller sends. `processed` can legitimately
    // carry an informational reason (e.g. "no matching connection")
    // that shouldn't be hidden just because no error occurred.
    await ctx.db.patch(eventId, {
      status,
      errorReason,
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
