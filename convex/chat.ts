import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import type { Agent } from "@convex-dev/agent";
import {
  createThread as agentCreateThread,
  listUIMessages,
  syncStreams,
  vStreamArgs,
} from "@convex-dev/agent";
import type { ModelMessage } from "@ai-sdk/provider-utils";
import { action, internalAction, mutation, query } from "./_generated/server";
import { components, internal } from "./_generated/api";
import type { ActionCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getEffectiveUserId } from "./lib/auth";
import { coachAgent, coachAgentFallback } from "./ai/coach";
import { programmingAgent, programmingAgentFallback } from "./ai/agents/programming";
import { recoveryAgent, recoveryAgentFallback } from "./ai/agents/recovery";
import {
  coachingAgent as coachingSpecialist,
  coachingAgentFallback as coachingSpecialistFallback,
} from "./ai/agents/coaching";
import { classifyIntent, type Intent } from "./ai/router";
import { streamWithRetry } from "./ai/resilience";
import { rateLimiter } from "./rateLimits";

const MAX_IMAGES_PER_MESSAGE = 4;

function getRoutedAgents(intent: Intent): { primary: Agent; fallback: Agent } | null {
  switch (intent) {
    case "programming":
      return { primary: programmingAgent, fallback: programmingAgentFallback };
    case "data":
      return { primary: recoveryAgent, fallback: recoveryAgentFallback };
    case "coaching":
      return { primary: coachingSpecialist, fallback: coachingSpecialistFallback };
    case "general":
      return null;
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

/** @deprecated Use sendMessageMutation for in-thread messages. Retained for welcome flow (no threadId). */
export const sendMessage = action({
  args: {
    threadId: v.optional(v.string()),
    prompt: v.string(),
    imageStorageIds: v.optional(v.array(v.id("_storage"))),
  },
  handler: async (ctx, { threadId, prompt, imageStorageIds }) => {
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
        // Create new thread (stale or none exists)
        const { threadId: newThreadId } = await coachAgent.createThread(ctx, {
          userId,
        });
        targetThreadId = newThreadId;
      }
    }

    const resolvedPrompt = await buildPrompt(ctx, prompt, imageStorageIds ?? undefined);

    const intent = classifyIntent(prompt);
    const routed = getRoutedAgents(intent);
    if (routed) {
      await ctx.runMutation(internal.aiUsage.recordRouting, {
        userId,
        threadId: targetThreadId,
        intent,
      });
    }
    await streamWithRetry(ctx, {
      primaryAgent: coachAgent,
      fallbackAgent: coachAgentFallback,
      threadId: targetThreadId,
      userId,
      prompt: resolvedPrompt,
      ...(routed && { routedPrimary: routed.primary, routedFallback: routed.fallback }),
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

    let messageId: string;
    if (approved) {
      ({ messageId } = await coachAgent.approveToolCall(ctx, {
        threadId,
        approvalId,
        reason,
      }));
    } else {
      ({ messageId } = await coachAgent.denyToolCall(ctx, {
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
  },
  handler: async (ctx, { threadId, messageId }) => {
    const userId = await ctx.runQuery(internal.lib.auth.resolveEffectiveUserId, {});
    if (!userId) throw new Error("Not authenticated");

    await streamWithRetry(ctx, {
      primaryAgent: coachAgent,
      fallbackAgent: coachAgentFallback,
      threadId,
      userId,
      promptMessageId: messageId,
    });
  },
});

export const sendMessageMutation = mutation({
  args: {
    prompt: v.string(),
    threadId: v.string(),
    imageStorageIds: v.optional(v.array(v.id("_storage"))),
  },
  handler: async (ctx, { prompt, threadId, imageStorageIds }) => {
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
    });

    return { threadId };
  },
});

export const processMessage = internalAction({
  args: {
    threadId: v.string(),
    userId: v.string(),
    prompt: v.string(),
    imageStorageIds: v.optional(v.array(v.id("_storage"))),
  },
  handler: async (ctx, { threadId, userId, prompt, imageStorageIds }) => {
    const resolvedPrompt = await buildPrompt(ctx, prompt, imageStorageIds ?? undefined);

    // Intent classification uses text only (images require AI to classify)
    const intent = classifyIntent(prompt);
    const routed = getRoutedAgents(intent);
    if (routed) {
      await ctx.runMutation(internal.aiUsage.recordRouting, {
        userId,
        threadId,
        intent,
      });
    }
    await streamWithRetry(ctx, {
      primaryAgent: coachAgent,
      fallbackAgent: coachAgentFallback,
      threadId,
      userId,
      prompt: resolvedPrompt,
      ...(routed && { routedPrimary: routed.primary, routedFallback: routed.fallback }),
    });
  },
});
