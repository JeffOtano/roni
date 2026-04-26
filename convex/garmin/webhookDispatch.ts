/**
 * Normalizes already-logged Garmin Push payloads into domain tables.
 *
 * Each handler here is invoked after the raw payload has been written
 * to `garminWebhookEvents` with `status: "received"`. It updates that
 * row's status to "processed", "rejected", or "error" and writes to
 * the appropriate domain table.
 *
 * Exact payload shapes are partner-documented in the Activity/Health
 * API PDFs. Until those are wired through, normalizers here fail closed
 * (status "error") so we never corrupt domain data with a guess. The
 * `garminWebhookEvents` log retains the raw payload for replay.
 */

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import type { ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { normalizeGarminActivities } from "./activityNormalizer";
import {
  normalizeDailies,
  normalizeHrv,
  normalizePulseOx,
  normalizeRespiration,
  normalizeSkinTemp,
  normalizeSleeps,
  normalizeStressDetails,
  normalizeUserMetrics,
  WELLNESS_ENVELOPE_KEYS,
  type WellnessDailyPartial,
} from "./wellnessNormalizers";
import {
  extractGarminUserIdsFromDeregistration,
  groupSummaryEntriesByUser,
  parsePermissionChangePayload,
} from "./webhookPayloads";

/**
 * Garmin Push event types we subscribe to. Each string is the camelCase
 * summary name Garmin uses in both the Portal config and the payload
 * envelope (e.g. `{ "activities": [...] }` for the activities push).
 */
export const GARMIN_PUSH_EVENT_TYPES = [
  "activities",
  "dailies",
  "sleeps",
  "stressDetails",
  "hrv",
  "userMetrics",
  "pulseOx",
  "respiration",
  "skinTemp",
  "userPermissionChange",
  "deregistration",
] as const;

export type GarminPushEventType = (typeof GARMIN_PUSH_EVENT_TYPES)[number];

export const dispatchGarminWebhook = internalAction({
  args: {
    eventId: v.id("garminWebhookEvents"),
    eventType: v.string(),
    /**
     * Convex storage ID for the raw JSON body. The dispatcher fetches
     * the blob and parses it here instead of receiving the payload as
     * a function argument — multi-day dailies backfill bodies exceed
     * the 1 MiB per-value limit that applies to both args and
     * documents.
     */
    rawPayloadStorageId: v.id("_storage"),
  },
  handler: async (ctx, { eventId, eventType, rawPayloadStorageId }) => {
    const blob = await ctx.storage.get(rawPayloadStorageId);
    if (!blob) {
      await ctx.runMutation(internal.garmin.webhookEvents.updateStatus, {
        eventId,
        status: "error",
        errorReason: "raw payload storage blob missing",
      });
      return;
    }
    const rawBody = await blob.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      await ctx.runMutation(internal.garmin.webhookEvents.updateStatus, {
        eventId,
        status: "error",
        errorReason: "failed to parse raw payload as JSON",
      });
      return;
    }

    // userPermissionChange / deregistration carry no domain data — they
    // update the connection row directly.
    if (eventType === "deregistration") {
      return await handleDeregistration({ ctx, eventId, rawPayload: parsed });
    }
    if (eventType === "userPermissionChange") {
      return await handlePermissionChange({ ctx, eventId, rawPayload: parsed });
    }
    if (eventType === "activities") {
      return await handleActivities({ ctx, eventId, rawPayload: parsed });
    }
    if (
      eventType === "dailies" ||
      eventType === "sleeps" ||
      eventType === "stressDetails" ||
      eventType === "hrv" ||
      eventType === "userMetrics" ||
      eventType === "pulseOx" ||
      eventType === "respiration" ||
      eventType === "skinTemp"
    ) {
      return await handleWellness({ ctx, eventId, rawPayload: parsed, summaryKey: eventType });
    }

    await ctx.runMutation(internal.garmin.webhookEvents.updateStatus, {
      eventId,
      status: "error",
      errorReason: `Unhandled Garmin push event type: ${eventType}`,
    });
  },
});

interface WebhookHandlerArgs {
  ctx: ActionCtx;
  eventId: Id<"garminWebhookEvents">;
  rawPayload: unknown;
}

async function handleActivities({ ctx, eventId, rawPayload }: WebhookHandlerArgs): Promise<void> {
  const groups = groupSummaryEntriesByUser("activities", rawPayload);
  if (groups.length === 0) {
    await ctx.runMutation(internal.garmin.webhookEvents.updateStatus, {
      eventId,
      status: "rejected",
      errorReason: "activities payload missing userId",
    });
    return;
  }

  let persisted = 0;
  let skipped = 0;
  let malformed = 0;
  let statusUserId: Id<"users"> | undefined;
  let statusGarminUserId: string | undefined;

  for (const group of groups) {
    const connection = await ctx.runQuery(internal.garmin.connections.getByGarminUserId, {
      garminUserId: group.garminUserId,
    });
    if (!connection) {
      skipped++;
      continue;
    }

    const normalized = normalizeGarminActivities(group.payload);
    if (normalized.length === 0) {
      malformed++;
      continue;
    }

    await ctx.runMutation(internal.tonal.historySyncMutations.persistExternalActivities, {
      userId: connection.userId,
      activities: normalized,
    });
    persisted += normalized.length;
    statusUserId = groups.length === 1 ? connection.userId : undefined;
    statusGarminUserId = groups.length === 1 ? group.garminUserId : undefined;
  }

  if (persisted === 0) {
    await ctx.runMutation(internal.garmin.webhookEvents.updateStatus, {
      eventId,
      status: malformed > 0 ? "rejected" : "processed",
      errorReason:
        malformed > 0 ? "no well-formed activities in payload" : "no matching active connection",
    });
    return;
  }

  await ctx.runMutation(internal.garmin.webhookEvents.updateStatus, {
    eventId,
    status: "processed",
    errorReason: skipped > 0 ? `skipped ${skipped} unmatched Garmin user(s)` : undefined,
    garminUserId: statusGarminUserId,
    userId: statusUserId,
  });
}

type WellnessSummaryKey =
  | "dailies"
  | "sleeps"
  | "stressDetails"
  | "hrv"
  | "userMetrics"
  | "pulseOx"
  | "respiration"
  | "skinTemp";

interface WellnessHandlerArgs extends WebhookHandlerArgs {
  summaryKey: WellnessSummaryKey;
}

function normalizeForKey(key: WellnessSummaryKey, rawPayload: unknown): WellnessDailyPartial[] {
  switch (key) {
    case "dailies":
      return normalizeDailies(rawPayload);
    case "sleeps":
      return normalizeSleeps(rawPayload);
    case "stressDetails":
      return normalizeStressDetails(rawPayload);
    case "hrv":
      return normalizeHrv(rawPayload);
    case "userMetrics":
      return normalizeUserMetrics(rawPayload);
    case "pulseOx":
      return normalizePulseOx(rawPayload);
    case "respiration":
      return normalizeRespiration(rawPayload);
    case "skinTemp":
      return normalizeSkinTemp(rawPayload);
    default: {
      const _exhaustive: never = key;
      throw new Error(`Unhandled Garmin wellness summary key: ${_exhaustive}`);
    }
  }
}

async function handleWellness({
  ctx,
  eventId,
  rawPayload,
  summaryKey,
}: WellnessHandlerArgs): Promise<void> {
  const envelopeKey = WELLNESS_ENVELOPE_KEYS[summaryKey];
  const groups = groupSummaryEntriesByUser(envelopeKey, rawPayload);
  if (groups.length === 0) {
    await ctx.runMutation(internal.garmin.webhookEvents.updateStatus, {
      eventId,
      status: "rejected",
      errorReason: `${summaryKey} payload missing userId`,
    });
    return;
  }

  let persisted = 0;
  let skipped = 0;
  let malformed = 0;
  let statusUserId: Id<"users"> | undefined;
  let statusGarminUserId: string | undefined;

  for (const group of groups) {
    const connection = await ctx.runQuery(internal.garmin.connections.getByGarminUserId, {
      garminUserId: group.garminUserId,
    });
    if (!connection) {
      skipped++;
      continue;
    }

    const entries = normalizeForKey(summaryKey, group.payload);
    if (entries.length === 0) {
      malformed++;
      continue;
    }

    await ctx.runMutation(internal.garmin.wellnessDaily.upsertWellnessDaily, {
      userId: connection.userId,
      entries,
    });
    persisted += entries.length;
    statusUserId = groups.length === 1 ? connection.userId : undefined;
    statusGarminUserId = groups.length === 1 ? group.garminUserId : undefined;
  }

  if (persisted === 0) {
    await ctx.runMutation(internal.garmin.webhookEvents.updateStatus, {
      eventId,
      status: malformed > 0 ? "rejected" : "processed",
      errorReason:
        malformed > 0
          ? `no well-formed ${summaryKey} entries in payload`
          : "no matching active connection",
    });
    return;
  }

  await ctx.runMutation(internal.garmin.webhookEvents.updateStatus, {
    eventId,
    status: "processed",
    errorReason: skipped > 0 ? `skipped ${skipped} unmatched Garmin user(s)` : undefined,
    garminUserId: statusGarminUserId,
    userId: statusUserId,
  });
}

async function handleDeregistration({
  ctx,
  eventId,
  rawPayload,
}: WebhookHandlerArgs): Promise<void> {
  const garminUserIds = extractGarminUserIdsFromDeregistration(rawPayload);
  if (garminUserIds.length === 0) {
    await ctx.runMutation(internal.garmin.webhookEvents.updateStatus, {
      eventId,
      status: "rejected",
      errorReason: "deregistration payload missing userId",
    });
    return;
  }

  let matched = 0;
  let statusUserId: Id<"users"> | undefined;
  let statusGarminUserId: string | undefined;
  for (const garminUserId of garminUserIds) {
    const connection = await ctx.runQuery(internal.garmin.connections.getByGarminUserId, {
      garminUserId,
    });
    if (!connection) continue;
    await ctx.runMutation(internal.garmin.connections.markDisconnected, {
      userId: connection.userId,
      reason: "permission_revoked",
    });
    matched++;
    statusUserId = garminUserIds.length === 1 ? connection.userId : undefined;
    statusGarminUserId = garminUserIds.length === 1 ? garminUserId : undefined;
  }

  await ctx.runMutation(internal.garmin.webhookEvents.updateStatus, {
    eventId,
    status: "processed",
    errorReason: matched === 0 ? "no matching active connection" : undefined,
    garminUserId: statusGarminUserId,
    userId: statusUserId,
  });
}

async function handlePermissionChange({
  ctx,
  eventId,
  rawPayload,
}: WebhookHandlerArgs): Promise<void> {
  const parsed = parsePermissionChangePayload(rawPayload);
  if (parsed.length === 0) {
    await ctx.runMutation(internal.garmin.webhookEvents.updateStatus, {
      eventId,
      status: "rejected",
      errorReason: "permission change payload malformed",
    });
    return;
  }

  let matched = 0;
  let statusUserId: Id<"users"> | undefined;
  let statusGarminUserId: string | undefined;
  for (const entry of parsed) {
    const connection = await ctx.runQuery(internal.garmin.connections.getByGarminUserId, {
      garminUserId: entry.garminUserId,
    });
    if (!connection) continue;

    await ctx.runMutation(internal.garmin.connections.refreshPermissions, {
      userId: connection.userId,
      permissions: entry.permissions,
    });
    if (entry.permissions.length === 0) {
      await ctx.runMutation(internal.garmin.connections.markDisconnected, {
        userId: connection.userId,
        reason: "permission_revoked",
      });
    }
    matched++;
    statusUserId = parsed.length === 1 ? connection.userId : undefined;
    statusGarminUserId = parsed.length === 1 ? entry.garminUserId : undefined;
  }

  await ctx.runMutation(internal.garmin.webhookEvents.updateStatus, {
    eventId,
    status: "processed",
    errorReason: matched === 0 ? "no matching active connection" : undefined,
    garminUserId: statusGarminUserId,
    userId: statusUserId,
  });
}
