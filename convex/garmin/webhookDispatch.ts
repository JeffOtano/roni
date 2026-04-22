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
import { extractFirstUserIdFromSummary, normalizeGarminActivities } from "./activityNormalizer";
import {
  extractFirstUserIdFromWellness,
  normalizeDailies,
  normalizeHrv,
  normalizeSleeps,
  normalizeStressDetails,
  type WellnessDailyPartial,
} from "./wellnessNormalizers";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

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
  "userPermissionChange",
  "deregistration",
] as const;

export type GarminPushEventType = (typeof GARMIN_PUSH_EVENT_TYPES)[number];

export const dispatchGarminWebhook = internalAction({
  args: {
    eventId: v.id("garminWebhookEvents"),
    eventType: v.string(),
    rawPayload: v.any(),
  },
  handler: async (ctx, { eventId, eventType, rawPayload }) => {
    // userPermissionChange / deregistration carry no domain data — they
    // update the connection row directly.
    if (eventType === "deregistration") {
      return await handleDeregistration({ ctx, eventId, rawPayload });
    }
    if (eventType === "userPermissionChange") {
      return await handlePermissionChange({ ctx, eventId, rawPayload });
    }
    if (eventType === "activities") {
      return await handleActivities({ ctx, eventId, rawPayload });
    }
    if (
      eventType === "dailies" ||
      eventType === "sleeps" ||
      eventType === "stressDetails" ||
      eventType === "hrv"
    ) {
      return await handleWellness({ ctx, eventId, rawPayload, summaryKey: eventType });
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
  const garminUserId = extractFirstUserIdFromSummary("activities", rawPayload);
  if (!garminUserId) {
    await ctx.runMutation(internal.garmin.webhookEvents.updateStatus, {
      eventId,
      status: "rejected",
      errorReason: "activities payload missing userId",
    });
    return;
  }

  const connection = await ctx.runQuery(internal.garmin.connections.getByGarminUserId, {
    garminUserId,
  });
  if (!connection) {
    await ctx.runMutation(internal.garmin.webhookEvents.updateStatus, {
      eventId,
      status: "processed",
      errorReason: "no matching connection",
    });
    return;
  }

  const normalized = normalizeGarminActivities(rawPayload);
  if (normalized.length === 0) {
    await ctx.runMutation(internal.garmin.webhookEvents.updateStatus, {
      eventId,
      status: "rejected",
      errorReason: "no well-formed activities in payload",
      userId: connection.userId,
    });
    return;
  }

  await ctx.runMutation(internal.tonal.historySyncMutations.persistExternalActivities, {
    userId: connection.userId,
    activities: normalized,
  });

  await ctx.runMutation(internal.garmin.webhookEvents.updateStatus, {
    eventId,
    status: "processed",
    userId: connection.userId,
  });
}

type WellnessSummaryKey = "dailies" | "sleeps" | "stressDetails" | "hrv";

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
  }
}

async function handleWellness({
  ctx,
  eventId,
  rawPayload,
  summaryKey,
}: WellnessHandlerArgs): Promise<void> {
  const garminUserId = extractFirstUserIdFromWellness(summaryKey, rawPayload);
  if (!garminUserId) {
    await ctx.runMutation(internal.garmin.webhookEvents.updateStatus, {
      eventId,
      status: "rejected",
      errorReason: `${summaryKey} payload missing userId`,
    });
    return;
  }

  const connection = await ctx.runQuery(internal.garmin.connections.getByGarminUserId, {
    garminUserId,
  });
  if (!connection) {
    await ctx.runMutation(internal.garmin.webhookEvents.updateStatus, {
      eventId,
      status: "processed",
      errorReason: "no matching connection",
    });
    return;
  }

  const entries = normalizeForKey(summaryKey, rawPayload);
  if (entries.length === 0) {
    await ctx.runMutation(internal.garmin.webhookEvents.updateStatus, {
      eventId,
      status: "rejected",
      errorReason: `no well-formed ${summaryKey} entries in payload`,
      userId: connection.userId,
    });
    return;
  }

  await ctx.runMutation(internal.garmin.wellnessDaily.upsertWellnessDaily, {
    userId: connection.userId,
    entries,
  });

  await ctx.runMutation(internal.garmin.webhookEvents.updateStatus, {
    eventId,
    status: "processed",
    userId: connection.userId,
  });
}

async function handleDeregistration({
  ctx,
  eventId,
  rawPayload,
}: WebhookHandlerArgs): Promise<void> {
  const garminUserId = extractSingleGarminUserId(rawPayload);
  if (!garminUserId) {
    await ctx.runMutation(internal.garmin.webhookEvents.updateStatus, {
      eventId,
      status: "rejected",
      errorReason: "deregistration payload missing userId",
    });
    return;
  }

  const connection = await ctx.runQuery(internal.garmin.connections.getByGarminUserId, {
    garminUserId,
  });
  if (!connection) {
    await ctx.runMutation(internal.garmin.webhookEvents.updateStatus, {
      eventId,
      status: "processed",
      errorReason: "no matching connection",
    });
    return;
  }

  await ctx.runMutation(internal.garmin.connections.markDisconnected, {
    userId: connection.userId,
    reason: "user_disconnected",
  });
  await ctx.runMutation(internal.garmin.webhookEvents.updateStatus, {
    eventId,
    status: "processed",
    userId: connection.userId,
  });
}

async function handlePermissionChange({
  ctx,
  eventId,
  rawPayload,
}: WebhookHandlerArgs): Promise<void> {
  const parsed = parsePermissionChangePayload(rawPayload);
  if (!parsed) {
    await ctx.runMutation(internal.garmin.webhookEvents.updateStatus, {
      eventId,
      status: "rejected",
      errorReason: "permission change payload malformed",
    });
    return;
  }

  const connection = await ctx.runQuery(internal.garmin.connections.getByGarminUserId, {
    garminUserId: parsed.garminUserId,
  });
  if (!connection) {
    await ctx.runMutation(internal.garmin.webhookEvents.updateStatus, {
      eventId,
      status: "processed",
      errorReason: "no matching connection",
    });
    return;
  }

  await ctx.runMutation(internal.garmin.connections.refreshPermissions, {
    userId: connection.userId,
    permissions: parsed.permissions,
  });

  if (parsed.permissions.length === 0) {
    await ctx.runMutation(internal.garmin.connections.markDisconnected, {
      userId: connection.userId,
      reason: "permission_revoked",
    });
  }

  await ctx.runMutation(internal.garmin.webhookEvents.updateStatus, {
    eventId,
    status: "processed",
    userId: connection.userId,
  });
}

/**
 * Best-effort extraction of a single garmin userId from a deregistration
 * payload. Garmin sends `{ deregistrations: [{ userId: "...", ... }] }`
 * with one entry per deregistered user. We process one event at a time;
 * if Garmin batches multiple users in one push, handle the first and
 * log the rest in a follow-up.
 */
export function extractSingleGarminUserId(rawPayload: unknown): string | null {
  if (!isRecord(rawPayload)) return null;
  const list = rawPayload.deregistrations;
  if (!Array.isArray(list) || list.length === 0) return null;
  const first = list[0];
  if (!isRecord(first)) return null;
  return typeof first.userId === "string" ? first.userId : null;
}

export interface ParsedPermissionChange {
  readonly garminUserId: string;
  readonly permissions: string[];
}

export function parsePermissionChangePayload(rawPayload: unknown): ParsedPermissionChange | null {
  if (!isRecord(rawPayload)) return null;
  const list = rawPayload.userPermissionsChange;
  if (!Array.isArray(list) || list.length === 0) return null;
  const entry = list[0];
  if (!isRecord(entry)) return null;
  if (typeof entry.userId !== "string") return null;
  if (!Array.isArray(entry.permissions)) return null;
  const permissions = entry.permissions.filter((p): p is string => typeof p === "string");
  return { garminUserId: entry.userId, permissions };
}
