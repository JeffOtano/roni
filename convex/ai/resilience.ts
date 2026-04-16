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
const RETRY_DELAY_MS = 3000;

// User-visible messages for each BYOK error class. Written directly into
// the assistant side of the thread so the user sees an actionable message
// instead of the generic "I'm having trouble" fallback.
const BYOK_ERROR_MESSAGES: Record<ByokErrorCode, string> = {
  byok_key_invalid:
    "Your API key was rejected by the provider. Open **Settings → API Keys** to check or replace it, then try again.",
  byok_quota_exceeded:
    "Your API key's provider is rejecting requests — likely out of credit or over quota. Top up with your provider, or switch providers under **Settings → API Keys**, and try again.",
  byok_safety_blocked:
    "The provider blocked that response for safety reasons. Try rephrasing and sending again.",
  byok_unknown_error:
    "Your API key's provider returned an unexpected error. Double-check the key under **Settings → API Keys** or try again later.",
};

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------

const TRANSIENT_STATUS_CODES = new Set([429, 500, 502, 503]);

const TRANSIENT_MESSAGE_PATTERNS = [
  "high demand",
  "unavailable",
  "overloaded",
  "try again later",
  "rate limit",
  "resource_exhausted",
];

export function isTransientError(error: unknown): boolean {
  if (error instanceof TypeError && error.message.includes("fetch")) return true;

  if (error instanceof Error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") return true;

    const lower = error.message.toLowerCase();
    if (lower.includes("timeout") || lower.includes("aborted")) return true;
    if (TRANSIENT_MESSAGE_PATTERNS.some((p) => lower.includes(p))) return true;

    const status = (error as Error & { status?: number }).status;
    if (typeof status === "number" && TRANSIENT_STATUS_CODES.has(status)) return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// BYOK error classification
// ---------------------------------------------------------------------------

export type ByokErrorCode =
  | "byok_key_invalid"
  | "byok_quota_exceeded"
  | "byok_safety_blocked"
  | "byok_unknown_error";

/**
 * Collect every text fragment that could classify a BYOK error. The Vercel
 * AI SDK often wraps provider errors in an `APICallError` whose `.message`
 * is just "API call failed", while the real detail lives on `.responseBody`
 * or `.cause.message`. We must pattern-match across all of them so errors
 * like Anthropic's "Your credit balance is too low" don't slip through.
 */
function gatherErrorText(error: Error): string {
  const parts: string[] = [error.message];
  const extended = error as Error & {
    responseBody?: unknown;
    cause?: unknown;
    data?: unknown;
  };
  if (typeof extended.responseBody === "string") parts.push(extended.responseBody);
  if (extended.cause instanceof Error) parts.push(extended.cause.message);
  if (extended.data && typeof extended.data === "object") {
    parts.push(JSON.stringify(extended.data));
  }
  return parts.join(" ").toLowerCase();
}

export function classifyByokError(error: unknown): ByokErrorCode | null {
  if (!(error instanceof Error)) return null;

  const status = (error as Error & { status?: number }).status;
  const lower = gatherErrorText(error);

  if (status === 401 || status === 403) return "byok_key_invalid";
  if (
    lower.includes("api key not valid") ||
    lower.includes("api_key_invalid") ||
    lower.includes("authentication_error") ||
    lower.includes("invalid_api_key") ||
    lower.includes("incorrect api key")
  ) {
    return "byok_key_invalid";
  }

  if (status === 429) return "byok_quota_exceeded";
  if (
    lower.includes("resource_exhausted") ||
    lower.includes("quota") ||
    lower.includes("rate_limit_error") ||
    lower.includes("rate_limit_exceeded") ||
    lower.includes("credits are depleted") ||
    lower.includes("credit balance") ||
    lower.includes("insufficient_quota") ||
    lower.includes("billing")
  ) {
    return "byok_quota_exceeded";
  }

  if (
    lower.includes("safety") ||
    lower.includes("blocked") ||
    lower.includes("content_policy") ||
    lower.includes("output_blocked") ||
    lower.includes("content_policy_violation")
  ) {
    return "byok_safety_blocked";
  }

  return null;
}

export function throwIfByokError(error: unknown): void {
  const code = classifyByokError(error);
  if (code !== null) throw new Error(code);
}

export function isByokQuotaError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const status = (error as Error & { status?: number }).status;
  if (status === 429) return true;
  const lower = error.message.toLowerCase();
  return (
    lower.includes("resource_exhausted") || lower.includes("quota") || lower.includes("rate_limit")
  );
}

// Sanitization is mandatory: Google AI error bodies can echo the decrypted key.
export async function withByokErrorSanitization<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const code = classifyByokError(err);
    if (code !== null) {
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
  /** True when the user is on their own API key (not the house key). */
  isByok: boolean;
}

type PromptArgs =
  | { prompt: string | Array<ModelMessage>; maxOutputTokens: number }
  | { promptMessageId: string; maxOutputTokens: number }
  | { promptMessageId: string; prompt: Array<ModelMessage>; maxOutputTokens: number };

const STREAM_OPTIONS = {
  saveStreamDeltas: { chunking: "word" as const, throttleMs: 100 },
};

// Convex actions have a 600s hard limit. Budget 180s per attempt so all three
// attempts (primary + retry + fallback) fit within the action lifetime.
const ATTEMPT_TIMEOUT_MS = 180_000;

export async function streamWithRetry(ctx: ActionCtx, args: StreamWithRetryArgs): Promise<void> {
  const { primaryAgent, fallbackAgent, threadId, userId, isByok } = args;
  const promptArgs: PromptArgs = args.promptMessageId
    ? args.prompt !== undefined
      ? {
          promptMessageId: args.promptMessageId,
          prompt: args.prompt as Array<ModelMessage>,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
        }
      : { promptMessageId: args.promptMessageId, maxOutputTokens: MAX_OUTPUT_TOKENS }
    : { prompt: args.prompt!, maxOutputTokens: MAX_OUTPUT_TOKENS };

  /**
   * Try one attempt. Returns `true` when the attempt succeeded OR produced
   * a terminal error that's already been surfaced to the user, so the
   * caller should stop. Returns `false` only for transient errors that
   * should be retried on the next attempt in the chain.
   */
  const runAttempt = async (agent: Agent): Promise<boolean> => {
    try {
      await attemptStream(ctx, agent, threadId, userId, promptArgs);
      return true;
    } catch (error) {
      // BYOK errors always land as a user-visible assistant message so the
      // user knows to fix their key — never silently abort and never fall
      // back to the house key under BYOK.
      if (isByok) {
        const code = classifyByokError(error);
        if (code !== null) {
          await saveByokErrorAndNotify(ctx, threadId, userId, code, error);
          return true;
        }
      }
      if (!isTransientError(error)) {
        await saveErrorAndNotify(ctx, threadId, userId, error);
        return true;
      }
      return false;
    }
  };

  if (await runAttempt(primaryAgent)) return;
  await delay(RETRY_DELAY_MS);
  if (await runAttempt(primaryAgent)) return;

  try {
    await attemptStream(ctx, fallbackAgent, threadId, userId, promptArgs);
  } catch (error) {
    if (isByok) {
      const code = classifyByokError(error);
      if (code !== null) {
        await saveByokErrorAndNotify(ctx, threadId, userId, code, error);
        return;
      }
    }
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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("Stream timeout"), ATTEMPT_TIMEOUT_MS);
  try {
    const { thread } = await agent.continueThread(ctx, { threadId, userId });
    const result = await thread.streamText(
      { ...promptArgs, abortSignal: controller.signal },
      STREAM_OPTIONS,
    );
    await result.text;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Finalize any assistant messages left in `pending` state on the thread.
 * Normally `streamText`'s abortSignal handler does this, but provider
 * errors (network/billing/auth) surface directly as throws from
 * `result.text` — in that path the pending row is stranded forever until
 * we explicitly mark it failed. Must run before we save the follow-up
 * error message so the thread doesn't show a dangling spinner above the
 * explanation.
 */
async function finalizePendingMessages(
  ctx: ActionCtx,
  threadId: string,
  reason: string,
): Promise<void> {
  const result = await ctx.runQuery(components.agent.messages.listMessagesByThreadId, {
    threadId,
    paginationOpts: { cursor: null, numItems: 10 },
    order: "desc",
  });
  for (const message of result.page) {
    if (message.status !== "pending") continue;
    await ctx.runMutation(components.agent.messages.finalizeMessage, {
      messageId: message._id,
      result: { status: "failed", error: reason },
    });
  }
}

async function saveErrorAndNotify(
  ctx: ActionCtx,
  threadId: string,
  userId: string,
  error: unknown,
): Promise<void> {
  const reason = error instanceof Error ? error.message : String(error);
  await finalizePendingMessages(ctx, threadId, reason);
  await saveMessage(ctx, components.agent, {
    threadId,
    userId,
    message: { role: "assistant", content: AI_ERROR_MESSAGE },
  });
  await ctx.runAction(internal.discord.notifyError, {
    source: "streamWithRetry",
    message: reason,
    userId,
  });
}

/**
 * Save a user-visible assistant message explaining the BYOK error class so
 * the user can act on it, and ping ops with the (safe) error code only —
 * not the raw provider message, which can echo the decrypted key.
 */
async function saveByokErrorAndNotify(
  ctx: ActionCtx,
  threadId: string,
  userId: string,
  code: ByokErrorCode,
  error: unknown,
): Promise<void> {
  // Use the error code (not the raw message) as the finalize reason since
  // the provider body can include the decrypted key.
  await finalizePendingMessages(ctx, threadId, code);
  await saveMessage(ctx, components.agent, {
    threadId,
    userId,
    message: { role: "assistant", content: BYOK_ERROR_MESSAGES[code] },
  });
  await ctx.runAction(internal.discord.notifyError, {
    source: "streamWithRetry",
    message: `${code} (${error instanceof Error ? error.name : "Unknown"})`,
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
