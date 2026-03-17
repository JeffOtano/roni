import type { ToolCtx } from "@convex-dev/agent";
import type { ToolExecutionOptions } from "ai";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";

export function requireUserId(ctx: ToolCtx): Id<"users"> {
  if (!ctx.userId) throw new Error("Not authenticated");
  return ctx.userId as Id<"users">;
}

/** ToolCtx.userId is `string | undefined`; recordToolCall accepts `v.optional(v.string())` to avoid forbidden `as` casts. */

export function withToolTracking<TInput, TOutput>(
  toolName: string,
  fn: (ctx: ToolCtx, input: TInput, options: ToolExecutionOptions) => Promise<TOutput>,
): (ctx: ToolCtx, input: TInput, options: ToolExecutionOptions) => Promise<TOutput> {
  return async (ctx, input, options) => {
    const start = Date.now();
    try {
      const result = await fn(ctx, input, options);
      await ctx.runMutation(internal.aiUsage.recordToolCall, {
        userId: ctx.userId,
        threadId: ctx.threadId,
        toolName,
        durationMs: Date.now() - start,
        success: true,
      });
      return result;
    } catch (error) {
      await ctx.runMutation(internal.aiUsage.recordToolCall, {
        userId: ctx.userId,
        threadId: ctx.threadId,
        toolName,
        durationMs: Date.now() - start,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };
}
