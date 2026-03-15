import { v } from "convex/values";
import { action, internalAction, mutation, query } from "./_generated/server";
import { components, internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import {
  createThread as agentCreateThread,
  listUIMessages,
  saveMessage,
  syncStreams,
  vStreamArgs,
} from "@convex-dev/agent";
import { coachAgent } from "./ai/coach";
import { rateLimiter } from "./rateLimits";

const AI_ERROR_MESSAGE = "I'm having trouble right now. Please try again in a moment.";

export const createThread = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
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
  },
  handler: async (ctx, { threadId, prompt }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Rate limit
    await rateLimiter.limit(ctx, "sendMessage", {
      key: userId,
      throws: true,
    });

    const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

    let targetThreadId: string;
    if (threadId) {
      targetThreadId = threadId;
    } else {
      // Auto-resolve to active thread if not stale
      const active = await ctx.runQuery(internal.threads.getActiveThread, {
        userId,
      });

      if (active && Date.now() - active.lastMessageTime < STALE_THRESHOLD_MS) {
        targetThreadId = active.threadId;
      } else {
        // Create new thread (stale or none exists)
        const { threadId: newThreadId } = await coachAgent.createThread(ctx, {
          userId,
        });
        targetThreadId = newThreadId;
      }
    }

    // Stream response with delta saving
    try {
      const { thread } = await coachAgent.continueThread(ctx, {
        threadId: targetThreadId,
        userId,
      });

      await thread.streamText(
        { prompt },
        {
          saveStreamDeltas: { chunking: "word", throttleMs: 100 },
        },
      );
    } catch (error) {
      console.error("sendMessage AI error:", error);
      await saveMessage(ctx, components.agent, {
        threadId: targetThreadId,
        userId,
        message: { role: "assistant", content: AI_ERROR_MESSAGE },
      });
    }

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
    const userId = await getAuthUserId(ctx);
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
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    try {
      const { thread } = await coachAgent.continueThread(ctx, {
        threadId,
        userId,
      });

      await thread.streamText(
        { promptMessageId: messageId },
        { saveStreamDeltas: { chunking: "word", throttleMs: 100 } },
      );
    } catch (error) {
      console.error("continueAfterApproval AI error:", error);
      await saveMessage(ctx, components.agent, {
        threadId,
        userId,
        message: { role: "assistant", content: AI_ERROR_MESSAGE },
      });
    }
  },
});

export const sendMessageMutation = mutation({
  args: {
    prompt: v.string(),
    threadId: v.string(),
  },
  handler: async (ctx, { prompt, threadId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await rateLimiter.limit(ctx, "sendMessage", {
      key: userId,
      throws: true,
    });

    await ctx.scheduler.runAfter(0, internal.chat.processMessage, {
      threadId,
      userId,
      prompt,
    });

    return { threadId };
  },
});

export const processMessage = internalAction({
  args: {
    threadId: v.string(),
    userId: v.string(),
    prompt: v.string(),
  },
  handler: async (ctx, { threadId, userId, prompt }) => {
    try {
      const { thread } = await coachAgent.continueThread(ctx, {
        threadId,
        userId,
      });

      await thread.streamText(
        { prompt },
        { saveStreamDeltas: { chunking: "word", throttleMs: 100 } },
      );
    } catch (error) {
      console.error("processMessage AI error:", error);
      await saveMessage(ctx, components.agent, {
        threadId,
        userId,
        message: { role: "assistant", content: AI_ERROR_MESSAGE },
      });
    }
  },
});
