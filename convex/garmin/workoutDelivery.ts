import { isRateLimitError } from "@convex-dev/rate-limiter";
import { v } from "convex/values";
import { z } from "zod";
import { action, internalMutation, query } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { rateLimiter } from "../rateLimits";
import type { Movement } from "../tonal/types";
import { getEffectiveUserId } from "../lib/auth";
import { decryptGarminSecret, getGarminAppConfig, isGarminConfigured } from "./credentials";
import { createAndScheduleGarminWorkout } from "./trainingApi";
import { buildGarminStrengthWorkoutPayloadFromPlan } from "./workoutPayload";

const WORKOUT_IMPORT_PERMISSION = "WORKOUT_IMPORT";
const STALE_SENDING_MS = 10 * 60 * 1000;
const ERROR_REASON_MAX_LENGTH = 300;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const scheduledDateSchema = z
  .string()
  .regex(ISO_DATE_RE, "scheduledDate must be YYYY-MM-DD.")
  .refine(
    (value) => {
      const parsed = new Date(`${value}T12:00:00Z`);
      return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
    },
    { message: "scheduledDate must be YYYY-MM-DD." },
  );

type DeliveryStatus = Doc<"garminWorkoutDeliveries">["status"];

export type GarminWorkoutDeliverySummary =
  | { status: "none" }
  | {
      status: DeliveryStatus;
      scheduledDate: string;
      garminWorkoutId?: string;
      garminScheduleId?: string;
      errorReason?: string;
      sentAt?: number;
      updatedAt: number;
    };

export type SendGarminWorkoutResult =
  | {
      success: true;
      delivery: Extract<GarminWorkoutDeliverySummary, { status: "sent" }>;
    }
  | { success: false; error: string };

function truncate(input: string, maxLength: number): string {
  return input.length <= maxLength ? input : input.slice(0, maxLength).trimEnd();
}

function toSummary(row: Doc<"garminWorkoutDeliveries"> | null): GarminWorkoutDeliverySummary {
  if (!row) return { status: "none" };
  return {
    status: row.status,
    scheduledDate: row.scheduledDate,
    ...(row.garminWorkoutId !== undefined && { garminWorkoutId: row.garminWorkoutId }),
    ...(row.garminScheduleId !== undefined && { garminScheduleId: row.garminScheduleId }),
    ...(row.errorReason !== undefined && { errorReason: row.errorReason }),
    ...(row.sentAt !== undefined && { sentAt: row.sentAt }),
    updatedAt: row.updatedAt,
  };
}

export const getMyWorkoutDelivery = query({
  args: {
    workoutPlanId: v.id("workoutPlans"),
    scheduledDate: v.string(),
  },
  handler: async (ctx, { workoutPlanId, scheduledDate }): Promise<GarminWorkoutDeliverySummary> => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) return { status: "none" };

    const plan = await ctx.db.get(workoutPlanId);
    if (!plan || plan.userId !== userId) return { status: "none" };

    const row = await ctx.db
      .query("garminWorkoutDeliveries")
      .withIndex("by_userId_workoutPlanId_scheduledDate", (q) =>
        q
          .eq("userId", userId)
          .eq("workoutPlanId", workoutPlanId)
          .eq("scheduledDate", scheduledDate),
      )
      .unique();
    return toSummary(row);
  },
});

export const startDeliveryAttempt = internalMutation({
  args: {
    userId: v.id("users"),
    workoutPlanId: v.id("workoutPlans"),
    scheduledDate: v.string(),
  },
  handler: async (
    ctx,
    { userId, workoutPlanId, scheduledDate },
  ): Promise<
    | { state: "claimed"; deliveryId: Id<"garminWorkoutDeliveries"> }
    | { state: "already_sent"; delivery: Extract<GarminWorkoutDeliverySummary, { status: "sent" }> }
    | { state: "in_progress" }
  > => {
    const now = Date.now();
    const existing = await ctx.db
      .query("garminWorkoutDeliveries")
      .withIndex("by_userId_workoutPlanId_scheduledDate", (q) =>
        q
          .eq("userId", userId)
          .eq("workoutPlanId", workoutPlanId)
          .eq("scheduledDate", scheduledDate),
      )
      .unique();

    if (!existing) {
      const deliveryId = await ctx.db.insert("garminWorkoutDeliveries", {
        userId,
        workoutPlanId,
        scheduledDate,
        status: "sending",
        createdAt: now,
        updatedAt: now,
      });
      return { state: "claimed", deliveryId };
    }

    if (existing.status === "sent") {
      return {
        state: "already_sent",
        delivery: toSummary(existing) as Extract<GarminWorkoutDeliverySummary, { status: "sent" }>,
      };
    }

    if (existing.status === "sending" && existing.updatedAt > now - STALE_SENDING_MS) {
      return { state: "in_progress" };
    }

    await ctx.db.patch(existing._id, {
      status: "sending",
      errorReason: undefined,
      updatedAt: now,
    });
    return { state: "claimed", deliveryId: existing._id };
  },
});

export const markDeliverySent = internalMutation({
  args: {
    deliveryId: v.id("garminWorkoutDeliveries"),
    garminWorkoutId: v.string(),
    garminScheduleId: v.optional(v.string()),
  },
  handler: async (
    ctx,
    { deliveryId, garminWorkoutId, garminScheduleId },
  ): Promise<Extract<GarminWorkoutDeliverySummary, { status: "sent" }>> => {
    const now = Date.now();
    await ctx.db.patch(deliveryId, {
      status: "sent",
      garminWorkoutId,
      ...(garminScheduleId !== undefined && { garminScheduleId }),
      errorReason: undefined,
      sentAt: now,
      updatedAt: now,
    });
    const row = await ctx.db.get(deliveryId);
    return toSummary(row) as Extract<GarminWorkoutDeliverySummary, { status: "sent" }>;
  },
});

export const markDeliveryFailed = internalMutation({
  args: {
    deliveryId: v.id("garminWorkoutDeliveries"),
    errorReason: v.string(),
  },
  handler: async (ctx, { deliveryId, errorReason }) => {
    await ctx.db.patch(deliveryId, {
      status: "failed",
      errorReason: truncate(errorReason, ERROR_REASON_MAX_LENGTH),
      updatedAt: Date.now(),
    });
  },
});

export const sendWorkoutPlanToGarmin = action({
  args: {
    workoutPlanId: v.id("workoutPlans"),
    scheduledDate: v.string(),
  },
  handler: async (ctx, { workoutPlanId, scheduledDate }): Promise<SendGarminWorkoutResult> => {
    const parsedScheduledDate = scheduledDateSchema.safeParse(scheduledDate);
    if (!parsedScheduledDate.success) {
      return {
        success: false,
        error: parsedScheduledDate.error.issues[0]?.message ?? "scheduledDate must be YYYY-MM-DD.",
      };
    }
    const validScheduledDate = parsedScheduledDate.data;

    if (!isGarminConfigured()) {
      return { success: false, error: "Garmin integration is not available on this deployment." };
    }

    const userId = await ctx.runQuery(internal.lib.auth.resolveEffectiveUserId, {});
    if (!userId) return { success: false, error: "Not authenticated" };

    const plan = (await ctx.runQuery(internal.workoutPlans.getById, {
      planId: workoutPlanId,
      userId,
    })) as Doc<"workoutPlans"> | null;
    if (!plan) return { success: false, error: "Workout plan not found." };

    const connection = await ctx.runQuery(internal.garmin.connections.getActiveConnectionByUserId, {
      userId,
    });
    if (!connection) return { success: false, error: "Garmin is not connected." };
    if (!connection.permissions.includes(WORKOUT_IMPORT_PERMISSION)) {
      return {
        success: false,
        error: "Garmin workout import permission is not enabled for this connection.",
      };
    }

    try {
      await rateLimiter.limit(ctx, "sendGarminWorkout", { key: userId, throws: true });
    } catch (error) {
      return {
        success: false,
        error: isRateLimitError(error)
          ? "Too many Garmin send attempts. Please wait and try again."
          : "Unable to send this workout to Garmin right now.",
      };
    }

    const claim = await ctx.runMutation(internal.garmin.workoutDelivery.startDeliveryAttempt, {
      userId,
      workoutPlanId,
      scheduledDate: validScheduledDate,
    });
    if (claim.state === "already_sent") return { success: true, delivery: claim.delivery };
    if (claim.state === "in_progress") {
      return { success: false, error: "Garmin delivery is already in progress." };
    }

    try {
      const [accessToken, accessTokenSecret, movements] = await Promise.all([
        decryptGarminSecret(connection.accessTokenEncrypted),
        decryptGarminSecret(connection.accessTokenSecretEncrypted),
        ctx.runQuery(internal.tonal.movementSync.getAllMovements) as Promise<Movement[]>,
      ]);
      const config = getGarminAppConfig();
      const deliveryResult = await createAndScheduleGarminWorkout({
        credentials: {
          consumerKey: config.consumerKey,
          consumerSecret: config.consumerSecret,
          token: accessToken,
          tokenSecret: accessTokenSecret,
        },
        payload: buildGarminStrengthWorkoutPayloadFromPlan({
          workoutPlanId,
          title: plan.title,
          blocks: plan.blocks,
          movements,
          scheduledDate: validScheduledDate,
        }),
        scheduledDate: validScheduledDate,
      });

      const delivery = await ctx.runMutation(internal.garmin.workoutDelivery.markDeliverySent, {
        deliveryId: claim.deliveryId,
        garminWorkoutId: deliveryResult.garminWorkoutId,
        garminScheduleId: deliveryResult.garminScheduleId,
      });
      return { success: true, delivery };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Garmin workout delivery failed.";
      await ctx.runMutation(internal.garmin.workoutDelivery.markDeliveryFailed, {
        deliveryId: claim.deliveryId,
        errorReason: message,
      });
      return { success: false, error: message };
    }
  },
});
