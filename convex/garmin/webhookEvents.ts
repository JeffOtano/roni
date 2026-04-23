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
import { internalAction, internalMutation, internalQuery } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";

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
     * ID of the Convex storage blob holding the raw JSON body. Using
     * storage instead of an inline column lets us accept multi-MB
     * backfill payloads; document fields are capped at 1 MiB.
     */
    rawPayloadStorageId: v.id("_storage"),
  },
  handler: async (ctx, args): Promise<Id<"garminWebhookEvents">> => {
    const now = Date.now();
    return await ctx.db.insert("garminWebhookEvents", {
      eventType: args.eventType,
      garminUserId: args.garminUserId,
      userId: args.userId,
      rawPayloadStorageId: args.rawPayloadStorageId,
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

/** List up to 200 expired event rows, returning enough to delete their
 *  storage blobs and rows. */
export const listExpiredEvents = internalQuery({
  args: {},
  handler: async (ctx): Promise<Doc<"garminWebhookEvents">[]> => {
    const now = Date.now();
    return await ctx.db
      .query("garminWebhookEvents")
      .withIndex("by_expiresAt", (q) => q.lt("expiresAt", now))
      .take(200);
  },
});

export const deleteEventRows = internalMutation({
  args: { ids: v.array(v.id("garminWebhookEvents")) },
  handler: async (ctx, { ids }) => {
    for (const id of ids) {
      await ctx.db.delete(id);
    }
  },
});

/** Cron entry point. Deletes storage blobs first, then rows. */
export const sweepExpired = internalAction({
  args: {},
  handler: async (ctx): Promise<number> => {
    const expired = await ctx.runQuery(internal.garmin.webhookEvents.listExpiredEvents, {});
    for (const row of expired) {
      if (row.rawPayloadStorageId) {
        try {
          await ctx.storage.delete(row.rawPayloadStorageId);
        } catch {
          // Blob may already have been manually removed; proceed to
          // drop the row anyway so we don't leave orphan references.
        }
      }
    }
    await ctx.runMutation(internal.garmin.webhookEvents.deleteEventRows, {
      ids: expired.map((row) => row._id),
    });
    return expired.length;
  },
});
