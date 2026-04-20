import type { Agent } from "@convex-dev/agent";
import type { ModelMessage } from "@ai-sdk/provider-utils";
import { saveMessage } from "@convex-dev/agent";
import { APICallError } from "@ai-sdk/provider";
import type { TelemetrySettings } from "ai";
import { components, internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { BUDGET_WARNING_THRESHOLD, DAILY_TOKEN_BUDGET } from "../aiUsage";
import { getProviderConfig, type ProviderId } from "./providers";

const AI_ERROR_MESSAGE = "I'm having trouble right now. Please try again in a moment.";
const BUDGET_EXCEEDED_MESSAGE =
  "I've hit my daily thinking limit -- let's pick this up tomorrow. Your limit resets at midnight UTC.";
const MAX_OUTPUT_TOKENS = 4096;
const RETRY_DELAY_MS = 3000;

const SETTINGS_LINK = "[Settings](/settings)";

export function buildByokErrorMessage(code: ByokErrorCode, provider: ProviderId): string {
  const config = getProviderConfig(provider);
  const billingLink = `[${config.label} billing](${config.billingUrl})`;
  switch (code) {
    case "byok_key_invalid":
      return `**${config.label} rejected your API key.** Check or replace it in ${SETTINGS_LINK}, then try again.`;
    case "byok_quota_exceeded":
      return `**${config.label} is rejecting requests** — your account is out of credit or over quota. Top up at ${billingLink}, or switch providers in ${SETTINGS_LINK}, then try again.`;
    case "byok_safety_blocked":
      return `**${config.label} blocked that response for safety.** Try rephrasing and sending again.`;
    case "byok_unknown_error":
      return `**${config.label} returned an unexpected error.** Check your key in ${SETTINGS_LINK} or try again later.`;
  }
}

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
  // Prefer the SDK's own retry decision — it knows provider-specific cases
  // like Anthropic 529 "overloaded" that our pattern list would miss.
  if (APICallError.isInstance(error)) return error.isRetryable;

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

// Vercel AI SDK wraps provider errors: .message is generic, the real text
// lives on .responseBody / .cause.message. Pattern-match across all of them.
function gatherErrorText(error: Error): string {
  const parts: string[] = [error.message];
  if ("responseBody" in error && typeof error.responseBody === "string") {
    parts.push(error.responseBody);
  }
  if ("cause" in error && error.cause instanceof Error) {
    parts.push(error.cause.message);
  }
  if ("data" in error && error.data && typeof error.data === "object") {
    parts.push(JSON.stringify(error.data));
  }
  return parts.join(" ").toLowerCase();
}

export function classifyByokError(error: unknown): ByokErrorCode | null {
  if (!(error instanceof Error)) return null;

  // APICallError exposes a typed statusCode; fall back to ad-hoc `.status`
  // on bare errors (raw fetch, provider SDKs that don't wrap in APICallError).
  const status = APICallError.isInstance(error)
    ? error.statusCode
    : (error as Error & { status?: number }).status;
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

// Google AI error bodies can echo the decrypted key — never rethrow raw.
export async function withByokErrorSanitization<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const code = classifyByokError(err);
    if (code !== null) throw new Error(code);
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
  prompt?: string | Array<ModelMessage>;
  promptMessageId?: string;
  /** True when the user is on their own API key (not the house key). */
  isByok: boolean;
  /** The active provider. Drives the provider-specific BYOK error message. */
  provider: ProviderId;
}

type PromptArgs =
  | { prompt: string | Array<ModelMessage>; maxOutputTokens: number }
  | { promptMessageId: string; maxOutputTokens: number }
  | { promptMessageId: string; prompt: Array<ModelMessage>; maxOutputTokens: number };

const STREAM_OPTIONS = {
  saveStreamDeltas: { chunking: "word" as const, throttleMs: 100 },
};

// Convex actions have a 600s hard cap; budget 180s per attempt so 3 fit.
const ATTEMPT_TIMEOUT_MS = 180_000;

type AttemptOutcome = { done: true } | { done: false; error: unknown };

export async function streamWithRetry(ctx: ActionCtx, args: StreamWithRetryArgs): Promise<void> {
  const { primaryAgent, fallbackAgent, threadId, userId, isByok, provider } = args;
  const promptArgs: PromptArgs = args.promptMessageId
    ? args.prompt !== undefined
      ? {
          promptMessageId: args.promptMessageId,
          prompt: args.prompt as Array<ModelMessage>,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
        }
      : { promptMessageId: args.promptMessageId, maxOutputTokens: MAX_OUTPUT_TOKENS }
    : { prompt: args.prompt!, maxOutputTokens: MAX_OUTPUT_TOKENS };

  // One PostHog trace per user turn; retries + fallback share this ID.
  const runId = crypto.randomUUID();
  const telemetry: TelemetryArgs = { runId, userId, threadId, provider };

  const errorReport = { threadId, userId, isByok, provider };

  // `done` = success or terminal-error-already-reported; otherwise retryable transient.
  const runAttempt = async (agent: Agent): Promise<AttemptOutcome> => {
    try {
      await attemptStream({ ctx, agent, promptArgs, telemetry });
      return { done: true };
    } catch (error) {
      if (await tryReportByok(ctx, { ...errorReport, error })) return { done: true };
      if (!isTransientError(error)) {
        await reportError(ctx, { ...errorReport, error });
        return { done: true };
      }
      return { done: false, error };
    }
  };

  if ((await runAttempt(primaryAgent)).done) return;
  await delay(RETRY_DELAY_MS);
  if ((await runAttempt(primaryAgent)).done) return;

  const final = await runAttempt(fallbackAgent);
  if (final.done) return;
  // Fallback also hit a transient error — terminal now, surface the generic message.
  await reportError(ctx, { ...errorReport, error: final.error });
}

interface TelemetryArgs {
  runId: string;
  userId: string;
  threadId: string;
  provider: ProviderId;
}

interface AttemptStreamOptions {
  ctx: ActionCtx;
  agent: Agent;
  promptArgs: PromptArgs;
  telemetry: TelemetryArgs;
}

async function attemptStream({
  ctx,
  agent,
  promptArgs,
  telemetry,
}: AttemptStreamOptions): Promise<void> {
  const { threadId, userId } = telemetry;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("Stream timeout"), ATTEMPT_TIMEOUT_MS);
  try {
    const { thread } = await agent.continueThread(ctx, { threadId, userId });
    const result = await thread.streamText(
      {
        ...promptArgs,
        abortSignal: controller.signal,
        experimental_telemetry: buildTelemetryConfig(telemetry),
      },
      STREAM_OPTIONS,
    );
    await result.text;
  } finally {
    clearTimeout(timeout);
  }
}

// recordInputs/recordOutputs off: training snapshots and workout plans are PII.
function buildTelemetryConfig(telemetry: TelemetryArgs): TelemetrySettings {
  return {
    isEnabled: true,
    functionId: "coach-agent",
    recordInputs: false,
    recordOutputs: false,
    metadata: {
      posthog_distinct_id: telemetry.userId,
      posthog_trace_id: telemetry.runId,
      threadId: telemetry.threadId,
      provider: telemetry.provider,
    },
  };
}

interface ErrorReport {
  threadId: string;
  userId: string;
  error: unknown;
  isByok: boolean;
  provider: ProviderId;
}

// streamText's abortSignal handler finalizes on clean aborts; provider errors
// thrown from result.text bypass that path and leave a stranded pending row.
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

async function tryReportByok(ctx: ActionCtx, report: ErrorReport): Promise<boolean> {
  if (!report.isByok) return false;
  const code = classifyByokError(report.error);
  if (code === null) return false;
  // Provider bodies can include the decrypted key, so the finalize reason is the code only.
  await finalizePendingMessages(ctx, report.threadId, code);
  await saveMessage(ctx, components.agent, {
    threadId: report.threadId,
    userId: report.userId,
    message: { role: "assistant", content: buildByokErrorMessage(code, report.provider) },
  });
  await ctx.runAction(internal.discord.notifyError, {
    source: "streamWithRetry",
    message: `${code} on ${report.provider} (${report.error instanceof Error ? report.error.name : "Unknown"})`,
    userId: report.userId,
  });
  return true;
}

async function reportError(ctx: ActionCtx, report: ErrorReport): Promise<void> {
  const reason = report.error instanceof Error ? report.error.message : String(report.error);
  await finalizePendingMessages(ctx, report.threadId, reason);
  await saveMessage(ctx, components.agent, {
    threadId: report.threadId,
    userId: report.userId,
    message: { role: "assistant", content: AI_ERROR_MESSAGE },
  });
  await ctx.runAction(internal.discord.notifyError, {
    source: "streamWithRetry",
    message: reason,
    userId: report.userId,
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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
