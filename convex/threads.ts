import { internalQuery, query } from "./_generated/server";
import { components, internal } from "./_generated/api";
import { v } from "convex/values";
import { getEffectiveUserId } from "./lib/auth";

/**
 * Internal query: find the user's most recent active thread
 * and its last message timestamp.
 * Called by sendMessage action via ctx.runQuery.
 */
export const getActiveThread = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const threads = await ctx.runQuery(components.agent.threads.listThreadsByUserId, {
      userId: userId as string,
      paginationOpts: { cursor: null, numItems: 1 },
      order: "desc",
    });

    const thread = threads.page[0];
    if (!thread || thread.status !== "active") return null;

    const messages = await ctx.runQuery(components.agent.messages.listMessagesByThreadId, {
      threadId: thread._id,
      paginationOpts: { cursor: null, numItems: 1 },
      order: "desc",
    });

    const lastMessageTime = messages.page[0]?._creationTime ?? thread._creationTime;

    return { threadId: thread._id, lastMessageTime };
  },
});

/**
 * Public query: client subscribes to this to get the active thread ID.
 * Returns null if no active thread exists.
 */
export const getCurrentThread = query({
  args: {},
  handler: async (ctx): Promise<{ threadId: string; lastMessageTime: number } | null> => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) return null;

    return ctx.runQuery(internal.threads.getActiveThread, { userId });
  },
});

/**
 * Public query: loads messages from threads older than the current one.
 * Used for "Load earlier" in the continuous scroll.
 */
export const listConversationHistory = query({
  args: {
    beforeThreadId: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { beforeThreadId, limit = 20 }) => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) return { messages: [], hasMore: false };

    const threads = await ctx.runQuery(components.agent.threads.listThreadsByUserId, {
      userId: userId as string,
      paginationOpts: { cursor: null, numItems: 50 },
      order: "desc",
    });

    let foundCurrent = !beforeThreadId;
    const olderThreads = [];
    for (const thread of threads.page) {
      if (thread._id === beforeThreadId) {
        foundCurrent = true;
        continue;
      }
      if (foundCurrent && thread.status === "active") {
        olderThreads.push(thread);
      }
    }

    if (olderThreads.length === 0) return { messages: [], hasMore: false };

    const targetThread = olderThreads[0];
    const result = await ctx.runQuery(components.agent.messages.listMessagesByThreadId, {
      threadId: targetThread._id,
      paginationOpts: { cursor: null, numItems: limit },
      order: "asc",
    });

    return {
      messages: result.page,
      threadId: targetThread._id,
      hasMore: olderThreads.length > 1 || !result.isDone,
    };
  },
});
