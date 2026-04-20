"use node";

// Node runtime required: ai/otel.ts loads OpenTelemetry, which needs `performance`.

import { v } from "convex/values";
import { saveMessage } from "@convex-dev/agent";
import { action, type ActionCtx, internalAction } from "./_generated/server";
import { components, internal } from "./_generated/api";
import { buildCoachAgentsForProvider, STATIC_INSTRUCTIONS_HASH } from "./ai/coach";
import { checkDailyBudget, streamWithRetry } from "./ai/resilience";
import { flushTelemetry } from "./ai/otel";
import type { RunAccumulator } from "./ai/runTelemetry";
import { sanitizeTimezone } from "./ai/timeDecay";
import type { ProviderId } from "./ai/providers";
import * as analytics from "./lib/posthog";
import {
  assertThreadOwnership,
  buildPrompt,
  persistScheduledFailure,
  resolveUserProviderConfig,
  withByokErrorSanitization,
} from "./chatHelpers";

// Dev Convex URLs look like `https://<adj>-<animal>-123.convex.cloud` and
// prod ones look the same, so we flag prod on Vercel's build env instead.
const ENVIRONMENT: "dev" | "prod" = process.env.VERCEL_ENV === "production" ? "prod" : "dev";
const RELEASE_SHA = process.env.VERCEL_GIT_COMMIT_SHA;

async function persistRun(ctx: ActionCtx, accumulator: RunAccumulator): Promise<void> {
  try {
    await ctx.runMutation(internal.aiUsage.recordRun, accumulator.toRow());
  } catch {
    // Never fail the turn on telemetry persistence error.
  }
}

export const processMessage = internalAction({
  args: {
    threadId: v.string(),
    userId: v.id("users"),
    prompt: v.string(),
    imageStorageIds: v.optional(v.array(v.id("_storage"))),
    userTimezone: v.optional(v.string()),
  },
  handler: async (ctx, { threadId, userId, prompt, imageStorageIds, userTimezone: rawTz }) => {
    const userTimezone = sanitizeTimezone(rawTz);
    const budgetExceeded = await checkDailyBudget(ctx, userId, threadId);
    if (budgetExceeded) return;

    // Pre-save the user message once so retries use promptMessageId
    // instead of re-saving, re-embedding, and duplicating the message.
    const { messageId } = await saveMessage(ctx, components.agent, {
      threadId,
      userId,
      message: { role: "user" as const, content: prompt },
    });

    let provider: ProviderId | undefined;
    let accumulator: RunAccumulator | undefined;
    const startTime = Date.now();
    try {
      const providerConfig = await resolveUserProviderConfig(ctx, userId);
      provider = providerConfig.provider;

      const resolvedPrompt = await buildPrompt(ctx, prompt, imageStorageIds);

      const { primary, fallback } = buildCoachAgentsForProvider({
        ...providerConfig,
        userTimezone,
      });
      accumulator = await withByokErrorSanitization(() =>
        streamWithRetry(ctx, {
          primaryAgent: primary,
          fallbackAgent: fallback,
          threadId,
          userId,
          promptMessageId: messageId,
          prompt: typeof resolvedPrompt === "string" ? undefined : resolvedPrompt,
          isByok: !providerConfig.isHouseKey,
          provider: providerConfig.provider,
          source: "chat",
          environment: ENVIRONMENT,
          release: RELEASE_SHA,
          promptVersion: STATIC_INSTRUCTIONS_HASH,
        }),
      );
    } catch (error) {
      await persistScheduledFailure({
        ctx,
        threadId,
        userId,
        error,
        provider,
        source: "chatProcessing.processMessage",
      });
      return;
    } finally {
      if (accumulator) await persistRun(ctx, accumulator);
      await flushTelemetry();
    }

    analytics.capture(userId, "coach_response_received", {
      response_time_ms: Date.now() - startTime,
      has_images: (imageStorageIds?.length ?? 0) > 0,
    });
    await analytics.flush();
  },
});

export const continueAfterApproval = action({
  args: {
    threadId: v.string(),
    messageId: v.string(),
    userTimezone: v.optional(v.string()),
  },
  handler: async (ctx, { threadId, messageId, userTimezone: rawTz }) => {
    const userTimezone = sanitizeTimezone(rawTz);
    const userId = await ctx.runQuery(internal.lib.auth.resolveEffectiveUserId, {});
    if (!userId) throw new Error("Not authenticated");
    await assertThreadOwnership(ctx, threadId, userId);

    let provider: ProviderId | undefined;
    let accumulator: RunAccumulator | undefined;
    const startTime = Date.now();
    try {
      const providerConfig = await resolveUserProviderConfig(ctx, userId);
      provider = providerConfig.provider;

      const { primary, fallback } = buildCoachAgentsForProvider({
        ...providerConfig,
        userTimezone,
      });
      accumulator = await withByokErrorSanitization(() =>
        streamWithRetry(ctx, {
          primaryAgent: primary,
          fallbackAgent: fallback,
          threadId,
          userId,
          promptMessageId: messageId,
          isByok: !providerConfig.isHouseKey,
          provider: providerConfig.provider,
          source: "approval_continuation",
          environment: ENVIRONMENT,
          release: RELEASE_SHA,
          promptVersion: STATIC_INSTRUCTIONS_HASH,
        }),
      );
    } catch (error) {
      await persistScheduledFailure({
        ctx,
        threadId,
        userId,
        error,
        provider,
        source: "chatProcessing.continueAfterApproval",
      });
      return;
    } finally {
      if (accumulator) await persistRun(ctx, accumulator);
      await flushTelemetry();
    }

    analytics.capture(userId, "coach_response_received", {
      response_time_ms: Date.now() - startTime,
      after_approval: true,
    });
    await analytics.flush();
  },
});
