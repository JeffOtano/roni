"use node";

// Node runtime required: ai/otel.ts loads OpenTelemetry, which needs `performance`.

import { v } from "convex/values";
import { saveMessage } from "@convex-dev/agent";
import { internalAction } from "./_generated/server";
import { components } from "./_generated/api";
import { buildCoachAgentsForProvider } from "./ai/coach";
import { checkDailyBudget, streamWithRetry } from "./ai/resilience";
import { flushTelemetry } from "./ai/otel";
import { sanitizeTimezone } from "./ai/timeDecay";
import type { ProviderId } from "./ai/providers";
import * as analytics from "./lib/posthog";
import {
  buildPrompt,
  persistScheduledFailure,
  resolveUserProviderConfig,
  withByokErrorSanitization,
} from "./chatHelpers";

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
    const startTime = Date.now();
    try {
      const providerConfig = await resolveUserProviderConfig(ctx, userId);
      provider = providerConfig.provider;

      const resolvedPrompt = await buildPrompt(ctx, prompt, imageStorageIds);

      const { primary, fallback } = buildCoachAgentsForProvider({
        ...providerConfig,
        userTimezone,
      });
      await withByokErrorSanitization(() =>
        streamWithRetry(ctx, {
          primaryAgent: primary,
          fallbackAgent: fallback,
          threadId,
          userId,
          promptMessageId: messageId,
          prompt: typeof resolvedPrompt === "string" ? undefined : resolvedPrompt,
          isByok: !providerConfig.isHouseKey,
          provider: providerConfig.provider,
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
      await flushTelemetry();
    }

    analytics.capture(userId, "coach_response_received", {
      response_time_ms: Date.now() - startTime,
      has_images: (imageStorageIds?.length ?? 0) > 0,
    });
    await analytics.flush();
  },
});
