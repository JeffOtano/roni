import type { Agent } from "@convex-dev/agent";
import type { ModelMessage } from "@ai-sdk/provider-utils";
import { saveMessage } from "@convex-dev/agent";
import { components, internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { BUDGET_WARNING_THRESHOLD, DAILY_TOKEN_BUDGET } from "../aiUsage";

const AI_ERROR_MESSAGE = "I'm having trouble right now. Please try again in a moment.";
const BUDGET_EXCEEDED_MESSAGE =
  "I've hit my daily thinking limit -- let's pick this up tomorrow. Your limit resets at midnight UTC.";
const MAX_OUTPUT_TOKENS = 4096;
const RETRY_DELAY_MS = 1000;

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------

const TRANSIENT_STATUS_CODES = new Set([500, 502, 503]);

export function isTransientError(error: unknown): boolean {
  if (error instanceof TypeError && error.message.includes("fetch")) return true;

  if (error instanceof Error) {
    if (error.name === "TimeoutError") return true;
    if (error.message.toLowerCase().includes("timeout")) return true;

    const status = (error as Error & { status?: number }).status;
    if (typeof status === "number" && TRANSIENT_STATUS_CODES.has(status)) return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// BYOK error classification
// ---------------------------------------------------------------------------
//
// When the language model call fails because of something the user's Gemini
// API key caused (invalid key, exhausted quota, safety block), we want the
// chat action to SURFACE that to the user rather than silently swallow it
// into the "I'm having trouble right now" generic message. The user cannot
// fix a generic error, but they can fix "your Gemini key is invalid".
//
// CRITICAL INVARIANT: on BYOK failure, chat MUST NOT silently fall back to
// the house key. That is the cost-bleed the OSS release is designed to
// prevent. classifyByokError returns a typed code for known BYOK failure
// modes, and callers re-throw that code so the frontend can display a
// targeted remediation message. classifyByokError itself never reads or
// returns the raw error message, which can echo the decrypted Gemini key.

export type ByokErrorCode =
  | "byok_key_invalid"
  | "byok_quota_exceeded"
  | "byok_safety_blocked"
  | "byok_unknown_error";

/**
 * Classify an error thrown by the AI SDK or @convex-dev/agent into a BYOK
 * error code, or return null if the error is not BYOK-classifiable.
 *
 * This function intentionally inspects only `.status` and a lower-cased,
 * substring-matched version of the error message. The caller is responsible
 * for NEVER logging the raw message, which can contain the decrypted key
 * (Google AI error bodies include the key in text of the form
 * "API key AIza... is invalid"). The caller should only propagate the
 * returned ByokErrorCode.
 */
export function classifyByokError(error: unknown): ByokErrorCode | null {
  if (!(error instanceof Error)) return null;

  const status = (error as Error & { status?: number }).status;
  const lower = error.message.toLowerCase();

  if (status === 401 || status === 403) return "byok_key_invalid";
  if (lower.includes("api key not valid") || lower.includes("api_key_invalid")) {
    return "byok_key_invalid";
  }

  if (status === 429) return "byok_quota_exceeded";
  if (lower.includes("resource_exhausted") || lower.includes("quota")) {
    return "byok_quota_exceeded";
  }

  if (lower.includes("safety") || lower.includes("blocked")) {
    return "byok_safety_blocked";
  }

  return null;
}

/**
 * If the error is a BYOK-classifiable failure, throw a sanitized Error whose
 * message is the typed BYOK error code. Otherwise, return without throwing.
 *
 * This helper exists so the chat action handlers and streamWithRetry can
 * share a single place that converts raw AI-SDK errors into BYOK codes
 * without leaking the raw message (which may contain the decrypted key).
 */
export function throwIfByokError(error: unknown): void {
  const code = classifyByokError(error);
  if (code !== null) throw new Error(code);
}

/**
 * Run an action body that calls the Gemini language model and sanitize any
 * raw error message into a typed BYOK error code before re-throwing.
 *
 * Sanitization is critical because Google AI error bodies can echo the
 * decrypted API key back to us (for example "API key AIza... is invalid"),
 * and that string MUST NOT be logged, surfaced to the user, or stored.
 *
 * If the underlying error is not BYOK-classifiable, it is re-thrown unchanged
 * so the caller's existing transient/general error handling can take over.
 *
 * Shared across every call site that hits Gemini directly (chat, library
 * generation, progress photo analysis, etc.).
 */
export async function withByokErrorSanitization<T>(fn: () => Promise<T>): Promise<T> {
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

// ---------------------------------------------------------------------------
// Stream with retry + fallback
// ---------------------------------------------------------------------------

interface StreamWithRetryArgs {
  primaryAgent: Agent;
  fallbackAgent: Agent;
  threadId: string;
  userId: string;
  /** Text prompt or multimodal message array (text + images). */
  prompt?: string | Array<ModelMessage>;
  promptMessageId?: string;
}

type PromptArgs =
  | { prompt: string | Array<ModelMessage>; maxOutputTokens: number }
  | { promptMessageId: string; maxOutputTokens: number };

const STREAM_OPTIONS = {
  saveStreamDeltas: { chunking: "word" as const, throttleMs: 100 },
};

export async function streamWithRetry(ctx: ActionCtx, args: StreamWithRetryArgs): Promise<void> {
  const { primaryAgent, fallbackAgent, threadId, userId } = args;
  const promptArgs: PromptArgs =
    args.prompt !== undefined
      ? { prompt: args.prompt, maxOutputTokens: MAX_OUTPUT_TOKENS }
      : { promptMessageId: args.promptMessageId!, maxOutputTokens: MAX_OUTPUT_TOKENS };

  // Attempt 1: primary (Gemini Pro)
  try {
    await attemptStream(ctx, primaryAgent, threadId, userId, promptArgs);
    return;
  } catch (error) {
    // BYOK errors are terminal: do not retry, do not save a generic error
    // message, and do not silently fall back to anything. Re-throw a typed
    // code so the chat action handler can surface it to the user.
    throwIfByokError(error);
    if (!isTransientError(error)) {
      await saveErrorAndNotify(ctx, threadId, userId, error);
      return;
    }
  }

  // Attempt 2: retry primary after delay
  await delay(RETRY_DELAY_MS);
  try {
    await attemptStream(ctx, primaryAgent, threadId, userId, promptArgs);
    return;
  } catch (error) {
    throwIfByokError(error);
    if (!isTransientError(error)) {
      await saveErrorAndNotify(ctx, threadId, userId, error);
      return;
    }
  }

  // Attempt 3: fallback (Gemini Flash)
  try {
    await attemptStream(ctx, fallbackAgent, threadId, userId, promptArgs);
  } catch (error) {
    throwIfByokError(error);
    await saveErrorAndNotify(ctx, threadId, userId, error);
  }
}

async function attemptStream(
  ctx: ActionCtx,
  agent: Agent,
  threadId: string,
  userId: string,
  promptArgs: PromptArgs,
): Promise<void> {
  const { thread } = await agent.continueThread(ctx, { threadId, userId });
  const result = await thread.streamText(promptArgs, STREAM_OPTIONS);
  await result.text;
}

async function saveErrorAndNotify(
  ctx: ActionCtx,
  threadId: string,
  userId: string,
  error: unknown,
): Promise<void> {
  await saveMessage(ctx, components.agent, {
    threadId,
    userId,
    message: { role: "assistant", content: AI_ERROR_MESSAGE },
  });
  await ctx.runAction(internal.discord.notifyError, {
    source: "streamWithRetry",
    message: error instanceof Error ? error.message : String(error),
    userId,
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if a user has exceeded their daily token budget.
 * Returns true if budget is exceeded (caller should abort).
 */
export async function checkDailyBudget(
  ctx: ActionCtx,
  userId: string,
  threadId: string,
): Promise<boolean> {
  const todayUsage = await ctx.runQuery(internal.aiUsage.getDailyTokenUsage, {
    userId: userId as Id<"users">,
  });

  if (todayUsage >= DAILY_TOKEN_BUDGET) {
    await saveMessage(ctx, components.agent, {
      threadId,
      userId,
      message: { role: "assistant", content: BUDGET_EXCEEDED_MESSAGE },
    });
    return true;
  }

  if (todayUsage >= DAILY_TOKEN_BUDGET * BUDGET_WARNING_THRESHOLD) {
    void ctx.runAction(internal.discord.notifyError, {
      source: "aiBudget",
      message: `User ${userId} at ${Math.round((todayUsage / DAILY_TOKEN_BUDGET) * 100)}% of daily token budget (${todayUsage.toLocaleString()} / ${DAILY_TOKEN_BUDGET.toLocaleString()})`,
      userId,
    });
  }

  return false;
}
