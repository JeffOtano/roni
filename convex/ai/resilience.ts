import type { Agent } from "@convex-dev/agent";
import type { ModelMessage } from "@ai-sdk/provider-utils";
import { saveMessage } from "@convex-dev/agent";
import { components, internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { weekPlanPresentationSchema } from "./schemas";
import type { WeekPlanPresentation } from "./schemas";

const AI_ERROR_MESSAGE = "I'm having trouble right now. Please try again in a moment.";
const BUDGET_EXCEEDED_MESSAGE =
  "I've hit my daily thinking limit -- let's pick this up tomorrow. Your limit resets at midnight UTC.";
const MAX_OUTPUT_TOKENS = 4096;
const RETRY_DELAY_MS = 1000;

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------

const TRANSIENT_STATUS_CODES = new Set([429, 500, 502, 503]);

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
// Week-plan output validation
// ---------------------------------------------------------------------------

const WEEK_PLAN_REGEX = /```week-plan\s*\n([\s\S]*?)\n```/;

export function extractWeekPlanJson(text: string): WeekPlanPresentation | null {
  const match = text.match(WEEK_PLAN_REGEX);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]);
    return weekPlanPresentationSchema.parse(parsed);
  } catch {
    return null;
  }
}

function containsWeekPlanBlock(text: string): boolean {
  return WEEK_PLAN_REGEX.test(text);
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
    const result = await attemptStream(ctx, primaryAgent, threadId, userId, promptArgs);
    await validateWeekPlanIfNeeded(ctx, primaryAgent, threadId, userId, result);
    return;
  } catch (error) {
    if (!isTransientError(error)) {
      await saveErrorAndNotify(ctx, threadId, userId, error);
      return;
    }
  }

  // Attempt 2: retry primary after delay
  await delay(RETRY_DELAY_MS);
  try {
    const result = await attemptStream(ctx, primaryAgent, threadId, userId, promptArgs);
    await validateWeekPlanIfNeeded(ctx, primaryAgent, threadId, userId, result);
    return;
  } catch (error) {
    if (!isTransientError(error)) {
      await saveErrorAndNotify(ctx, threadId, userId, error);
      return;
    }
  }

  // Attempt 3: fallback (Gemini Flash)
  try {
    const result = await attemptStream(ctx, fallbackAgent, threadId, userId, promptArgs);
    await validateWeekPlanIfNeeded(ctx, fallbackAgent, threadId, userId, result);
  } catch (error) {
    await saveErrorAndNotify(ctx, threadId, userId, error);
  }
}

async function attemptStream(
  ctx: ActionCtx,
  agent: Agent,
  threadId: string,
  userId: string,
  promptArgs: PromptArgs,
): Promise<string> {
  const { thread } = await agent.continueThread(ctx, { threadId, userId });
  const result = await thread.streamText(promptArgs, STREAM_OPTIONS);
  const text = await result.text;
  return text;
}

async function validateWeekPlanIfNeeded(
  ctx: ActionCtx,
  agent: Agent,
  threadId: string,
  userId: string,
  responseText: string,
): Promise<void> {
  if (!containsWeekPlanBlock(responseText)) return;
  if (extractWeekPlanJson(responseText) !== null) return;

  // Week-plan block found but invalid -- retry once with correction prompt
  try {
    const { thread } = await agent.continueThread(ctx, { threadId, userId });
    const retryResult = await thread.streamText(
      {
        prompt:
          "Your previous week-plan JSON was malformed. Please regenerate it with the exact format specified in your instructions.",
        maxOutputTokens: MAX_OUTPUT_TOKENS,
      },
      STREAM_OPTIONS,
    );
    await retryResult.text;
  } catch {
    // Validation retry failed -- non-critical, continue
  }
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
  const { DAILY_TOKEN_BUDGET, BUDGET_WARNING_THRESHOLD } = await import("../aiUsage");
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
