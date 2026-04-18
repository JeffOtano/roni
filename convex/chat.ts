import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import {
  createThread as agentCreateThread,
  listUIMessages,
  saveMessage,
  syncStreams,
  vStreamArgs,
} from "@convex-dev/agent";
import { action, internalAction, mutation, query } from "./_generated/server";
import { components, internal } from "./_generated/api";
import { getEffectiveUserId } from "./lib/auth";
import { buildCoachAgentForStorageOnly, buildCoachAgentsForProvider } from "./ai/coach";
import { checkDailyBudget, streamWithRetry } from "./ai/resilience";
import { rateLimiter } from "./rateLimits";
import { sanitizeTimezone } from "./ai/timeDecay";
import type { ProviderId } from "./ai/providers";
import * as analytics from "./lib/posthog";
import {
  assertThreadOwnership,
  buildPrompt,
  persistScheduledFailure,
  resolveUserProviderConfig,
  validateUserProviderKey,
  withByokErrorSanitization,
} from "./chatHelpers";

export const generateImageUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await rateLimiter.limit(ctx, "imageUpload", { key: userId, throws: true });

    const uploadUrl = await ctx.storage.generateUploadUrl();
    return { uploadUrl };
  },
});

export const createThread = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const threadId = await agentCreateThread(ctx, components.agent, {
      userId,
    });
    return { threadId };
  },
});

/**
 * Creates a new thread and sends the first message. Validates the BYOK key
 * synchronously so key errors surface before the thread is created. The LLM
 * response is scheduled asynchronously (same as sendMessageToThread) so the
 * frontend is never blocked on the full inference roundtrip.
 */
export const createThreadWithMessage = action({
  args: {
    threadId: v.optional(v.string()),
    prompt: v.string(),
    imageStorageIds: v.optional(v.array(v.id("_storage"))),
    userTimezone: v.optional(v.string()),
  },
  handler: async (ctx, { threadId, prompt, imageStorageIds, userTimezone: rawTz }) => {
    const userTimezone = sanitizeTimezone(rawTz);
    const userId = await ctx.runQuery(internal.lib.auth.resolveEffectiveUserId, {});
    if (!userId) throw new Error("Not authenticated");

    // Rate limit: burst + daily cap
    await rateLimiter.limit(ctx, "sendMessage", {
      key: userId,
      throws: true,
    });
    await rateLimiter.limit(ctx, "dailyMessages", {
      key: userId,
      throws: true,
    });

    const staleHours = await ctx.runQuery(internal.userProfiles.getThreadStaleHours, { userId });
    const staleMs = staleHours * 60 * 60 * 1000;

    // Validate key early so BYOK errors surface before the thread is created.
    // Quota is checked later in processMessage.
    await validateUserProviderKey(ctx, userId);

    let targetThreadId: string;
    if (threadId) {
      await assertThreadOwnership(ctx, threadId, userId);
      targetThreadId = threadId;
    } else {
      // Auto-resolve to active thread if not stale
      const active = await ctx.runQuery(internal.threads.getActiveThread, {
        userId,
      });

      if (active && Date.now() - active.lastMessageTime < staleMs) {
        targetThreadId = active.threadId;
      } else {
        // Create new thread (stale or none exists). createThread is the
        // standalone helper from @convex-dev/agent that writes directly
        // into the agent component's storage with no LLM call, so it does
        // not need a per-request agent instance.
        const newThreadId = await agentCreateThread(ctx, components.agent, {
          userId,
        });
        targetThreadId = newThreadId;
      }
    }

    // Schedule the LLM response asynchronously so the frontend gets the
    // threadId back immediately. processMessage handles BYOK resolution,
    // budget checks, streaming, retries, and analytics.
    await ctx.scheduler.runAfter(0, internal.chat.processMessage, {
      threadId: targetThreadId,
      userId,
      prompt,
      imageStorageIds,
      userTimezone,
    });

    return { threadId: targetThreadId };
  },
});

export const listMessages = query({
  args: {
    threadId: v.string(),
    paginationOpts: paginationOptsValidator,
    streamArgs: vStreamArgs,
  },
  handler: async (ctx, args) => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertThreadOwnership(ctx, args.threadId, userId);

    const paginated = await listUIMessages(ctx, components.agent, {
      threadId: args.threadId,
      paginationOpts: args.paginationOpts,
    });
    const streams = await syncStreams(ctx, components.agent, {
      threadId: args.threadId,
      streamArgs: args.streamArgs,
    });
    return { ...paginated, streams };
  },
});

export const respondToToolApproval = mutation({
  args: {
    threadId: v.string(),
    approvalId: v.string(),
    approved: v.boolean(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { threadId, approvalId, approved, reason }) => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertThreadOwnership(ctx, threadId, userId);

    // approveToolCall and denyToolCall only write a tool-approval-response
    // message into the agent component's storage. They do not invoke the
    // language model, so we use buildCoachAgentForStorageOnly here, which
    // satisfies the Agent constructor with the server provider but does
    // not (and must not) be used to make any LLM call. The actual LLM
    // continuation happens in continueAfterApproval below, which resolves
    // the user's BYOK key the normal way.
    const storageAgent = buildCoachAgentForStorageOnly();

    let messageId: string;
    if (approved) {
      ({ messageId } = await storageAgent.approveToolCall(ctx, {
        threadId,
        approvalId,
        reason,
      }));
    } else {
      ({ messageId } = await storageAgent.denyToolCall(ctx, {
        threadId,
        approvalId,
        reason,
      }));
    }
    return { messageId };
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
    const startTime = Date.now();
    try {
      const providerConfig = await resolveUserProviderConfig(ctx, userId);
      provider = providerConfig.provider;

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
        source: "chat.continueAfterApproval",
      });
      return;
    }

    analytics.capture(userId, "coach_response_received", {
      response_time_ms: Date.now() - startTime,
      after_approval: true,
    });
    await analytics.flush();
  },
});

/**
 * Appends a message to an existing thread. Schedules the LLM response
 * asynchronously. Use this for all in-thread messages once the thread exists.
 */
export const sendMessageToThread = mutation({
  args: {
    prompt: v.string(),
    threadId: v.string(),
    imageStorageIds: v.optional(v.array(v.id("_storage"))),
    userTimezone: v.optional(v.string()),
  },
  handler: async (ctx, { prompt, threadId, imageStorageIds, userTimezone: rawTz }) => {
    const userTimezone = sanitizeTimezone(rawTz);
    const userId = await getEffectiveUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await assertThreadOwnership(ctx, threadId, userId);

    await rateLimiter.limit(ctx, "sendMessage", {
      key: userId,
      throws: true,
    });
    await rateLimiter.limit(ctx, "dailyMessages", {
      key: userId,
      throws: true,
    });

    await ctx.scheduler.runAfter(0, internal.chat.processMessage, {
      threadId,
      userId,
      prompt,
      imageStorageIds,
      userTimezone,
    });

    return { threadId };
  },
});

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
        source: "chat.processMessage",
      });
      return;
    }

    analytics.capture(userId, "coach_response_received", {
      response_time_ms: Date.now() - startTime,
      has_images: (imageStorageIds?.length ?? 0) > 0,
    });
    await analytics.flush();
  },
});
