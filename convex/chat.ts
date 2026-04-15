import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import {
  createThread as agentCreateThread,
  listUIMessages,
  saveMessage,
  syncStreams,
  vStreamArgs,
} from "@convex-dev/agent";
import type { ModelMessage } from "@ai-sdk/provider-utils";
import { action, internalAction, mutation, query } from "./_generated/server";
import { components, internal } from "./_generated/api";
import type { ActionCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getEffectiveUserId } from "./lib/auth";
import { buildCoachAgentForStorageOnly, buildCoachAgentsForProvider } from "./ai/coach";
import { type ProviderKeyResult, resolveProviderKey } from "./byok";
import { checkDailyBudget, classifyByokError, streamWithRetry } from "./ai/resilience";
import { rateLimiter } from "./rateLimits";
import * as analytics from "./lib/posthog";

const MAX_IMAGES_PER_MESSAGE = 4;

// Like resolveUserProviderConfig but skips the quota check.
async function validateUserProviderKey(ctx: ActionCtx, userId: string): Promise<void> {
  const context = await ctx.runQuery(internal.byok._getKeyResolutionContext, {
    userId: userId as Id<"users">,
  });
  if (!context) throw new Error("byok_user_not_found");
  await resolveProviderKey(context.profile, context.userCreationTime);
}

async function resolveUserProviderConfig(
  ctx: ActionCtx,
  userId: string,
): Promise<ProviderKeyResult> {
  const context = await ctx.runQuery(internal.byok._getKeyResolutionContext, {
    userId: userId as Id<"users">,
  });
  if (!context) throw new Error("byok_user_not_found");
  const result = await resolveProviderKey(context.profile, context.userCreationTime);

  // Enforce monthly cap only when actually using the house key.
  const killSwitchActive = process.env.BYOK_DISABLED === "true";
  if (result.isHouseKey && !killSwitchActive) {
    try {
      await ctx.runMutation(internal.byok._checkHouseKeyQuota, {
        userId: userId as Id<"users">,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message.toLowerCase() : "";
      if (msg.includes("rate") || msg.includes("limit")) {
        throw new Error("house_key_quota_exhausted");
      }
      throw err;
    }
  }

  return result;
}

/**
 * Run an action body that calls the Gemini language model and sanitize any
 * raw error message into a typed BYOK error code before re-throwing. The
 * sanitization is critical because Google AI error bodies can echo the
 * decrypted API key back to us (for example "API key AIza... is invalid"),
 * and we MUST NOT log or surface that.
 *
 * If the underlying error is not BYOK-classifiable, it is re-thrown
 * unchanged so the existing transient-error handling can take over.
 */
async function withByokErrorSanitization<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const code = classifyByokError(err);
    if (code !== null) {
      // Throw the sanitized code only. Never log or rethrow the raw message.
      throw new Error(code);
    }
    throw err;
  }
}

/**
 * Resolves storage IDs to URLs and builds a multimodal ModelMessage array.
 * Returns the plain text string when no images are provided.
 */
async function buildPrompt(
  ctx: ActionCtx,
  text: string,
  imageStorageIds?: Id<"_storage">[],
): Promise<string | Array<ModelMessage>> {
  if (!imageStorageIds || imageStorageIds.length === 0) return text;

  if (imageStorageIds.length > MAX_IMAGES_PER_MESSAGE) {
    throw new Error(`Maximum ${MAX_IMAGES_PER_MESSAGE} images per message`);
  }

  const imageUrls = await Promise.all(
    imageStorageIds.map(async (storageId) => {
      const url = await ctx.storage.getUrl(storageId);
      if (!url) throw new Error(`Image not found: ${storageId}`);
      return url;
    }),
  );

  return [
    {
      role: "user" as const,
      content: [
        { type: "text" as const, text },
        ...imageUrls.map((url) => ({
          type: "image" as const,
          image: new URL(url),
          mimeType: "image/jpeg" as const,
        })),
      ],
    },
  ];
}

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
  handler: async (ctx, { threadId, prompt, imageStorageIds, userTimezone }) => {
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
  handler: async (ctx, { threadId, messageId, userTimezone }) => {
    const userId = await ctx.runQuery(internal.lib.auth.resolveEffectiveUserId, {});
    if (!userId) throw new Error("Not authenticated");

    const providerConfig = await resolveUserProviderConfig(ctx, userId);

    const startTime = Date.now();
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
      }),
    );

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
  handler: async (ctx, { prompt, threadId, imageStorageIds, userTimezone }) => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

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
  handler: async (ctx, { threadId, userId, prompt, imageStorageIds, userTimezone }) => {
    const budgetExceeded = await checkDailyBudget(ctx, userId, threadId);
    if (budgetExceeded) return;

    const providerConfig = await resolveUserProviderConfig(ctx, userId);

    const resolvedPrompt = await buildPrompt(ctx, prompt, imageStorageIds ?? undefined);

    // Pre-save the user message once so retries use promptMessageId
    // instead of re-saving, re-embedding, and duplicating the message.
    const { messageId } = await saveMessage(ctx, components.agent, {
      threadId,
      userId,
      message: { role: "user" as const, content: prompt },
    });

    const startTime = Date.now();
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
      }),
    );

    analytics.capture(userId, "coach_response_received", {
      response_time_ms: Date.now() - startTime,
      has_images: (imageStorageIds?.length ?? 0) > 0,
    });
    await analytics.flush();
  },
});
