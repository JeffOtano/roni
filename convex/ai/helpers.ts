import type { ToolCtx } from "@convex-dev/agent";
import type { ToolExecutionOptions } from "ai";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";

export function requireUserId(ctx: ToolCtx): Id<"users"> {
  if (!ctx.userId) throw new Error("Not authenticated");
  return ctx.userId as Id<"users">;
}

/** Validate and coerce to a session-duration literal (30, 45, or 60). */
export function toSessionDuration(value: string | number): 30 | 45 | 60 {
  const n = typeof value === "number" ? value : Number(value);
  if (n === 30 || n === 45 || n === 60) return n;
  throw new Error(`Invalid session duration: ${String(value)} (must be 30, 45, or 60)`);
}

/** ToolCtx.userId is `string | undefined`; recordToolCall accepts `v.optional(v.string())` to avoid forbidden `as` casts. */

const MAX_JSON_CHARS = 4096;
const TRUNCATION_SUFFIX = "...[truncated]";

function extractRunId(context: unknown): string | undefined {
  if (!context || typeof context !== "object") return undefined;
  const runId = (context as { runId?: unknown }).runId;
  return typeof runId === "string" ? runId : undefined;
}

/**
 * Stable, bounded JSON snapshot. Circular refs or non-serializable values
 * fall back to a short sentinel so telemetry never throws. Result is truncated
 * to {@link MAX_JSON_CHARS} (JS string length, not UTF-8 bytes) to keep Convex
 * rows small; 4096 chars at worst-case UTF-8 is still well under Convex's
 * per-field ceiling.
 */
function safeStringify(value: unknown): string {
  let json: string;
  try {
    json = JSON.stringify(value, (_key, val) => {
      if (typeof val === "bigint") return val.toString();
      if (val instanceof Error) return { name: val.name, message: val.message };
      return val;
    });
  } catch {
    return "[unserializable]";
  }
  if (json === undefined) return "";
  if (json.length <= MAX_JSON_CHARS) return json;
  // Avoid cutting in the middle of a UTF-16 surrogate pair (emoji, etc.).
  let cut = MAX_JSON_CHARS - TRUNCATION_SUFFIX.length;
  const code = json.charCodeAt(cut - 1);
  if (code >= 0xd800 && code <= 0xdbff) cut -= 1;
  return json.slice(0, cut) + TRUNCATION_SUFFIX;
}

export function withToolTracking<TInput, TOutput>(
  toolName: string,
  fn: (ctx: ToolCtx, input: TInput, options: ToolExecutionOptions) => Promise<TOutput>,
): (ctx: ToolCtx, input: TInput, options: ToolExecutionOptions) => Promise<TOutput> {
  return async (ctx, input, options) => {
    const start = Date.now();
    const runId = extractRunId(options.experimental_context);
    const toolCallId = options.toolCallId;
    const argsJson = safeStringify(input);
    try {
      const result = await fn(ctx, input, options);
      await ctx.runMutation(internal.aiUsage.recordToolCall, {
        userId: ctx.userId,
        threadId: ctx.threadId,
        toolName,
        durationMs: Date.now() - start,
        success: true,
        runId,
        toolCallId,
        argsJson,
        resultPreview: safeStringify(result),
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
        runId,
        toolCallId,
        argsJson,
      });
      throw error;
    }
  };
}
