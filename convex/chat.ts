import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";
import { components, internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import {
  createThread as agentCreateThread,
  listUIMessages,
  syncStreams,
  vStreamArgs,
} from "@convex-dev/agent";
import { coachAgent } from "./ai/coach";
import { rateLimiter } from "./rateLimits";

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
