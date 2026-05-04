"use node";

import type { Agent } from "@convex-dev/agent";
import type { ModelMessage } from "@ai-sdk/provider-utils";
import { saveMessage } from "@convex-dev/agent";
import { stepCountIs, type StepResult, type TelemetrySettings, type ToolSet } from "ai";
import { components, internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { budgetCapStopCondition, type BudgetCapTrip } from "./budgetCap";
import { COACH_MAX_STEPS } from "./coach";
import { type ProviderId } from "./providers";
import { type AttemptOutcome, runWithPrimaryCircuitBreaker } from "./resilienceCircuitBreaker";
import { type AccumulatorInit, RunAccumulator } from "./runTelemetry";
import { buildByokErrorMessage, classifyByokError } from "./byokErrors";
import { runInRunSpan } from "./otel";
import {
  buildProviderTransientMessage,
  classifyTransientError,
  isQuotaError,
  isTransientError,
} from "./transientErrors";

// Re-export for backwards compatibility with existing callers/tests.
export { buildByokErrorMessage, classifyByokError, withByokErrorSanitization } from "./byokErrors";
export type { ByokErrorCode } from "./byokErrors";
export { isTransientError } from "./transientErrors";

const AI_ERROR_MESSAGE = "I'm having trouble right now. Please try again in a moment.";
const BUDGET_CAP_MESSAGE =
  "This is getting expensive on your API key, so I'm simplifying here. Ask a narrower follow-up if you want me to keep going.";
const MAX_OUTPUT_TOKENS = 4096;
const RETRY_DELAY_MS = 3000;

interface StreamWithRetryArgs {
  primaryAgent: Agent;
  fallbackAgent: Agent;
  primaryModelName: string;
  threadId: string;
  userId: string;
  prompt?: string | Array<ModelMessage>;
  promptMessageId?: string;
  isByok: boolean;
  provider: ProviderId;
  source: "chat" | "approval_continuation";
  environment: "dev" | "prod";
  release?: string;
  promptVersion?: string;
  hasImages?: boolean;
  scheduledAt?: number;
  processingStartedAt?: number;
  retrievalEnabled?: boolean;
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

export async function streamWithRetry(
  ctx: ActionCtx,
  args: StreamWithRetryArgs,
): Promise<RunAccumulator> {
  const {
    primaryAgent,
    fallbackAgent,
    primaryModelName,
    threadId,
    userId,
    isByok,
    provider,
    source,
    environment,
    release,
    promptVersion,
    hasImages,
    scheduledAt,
    processingStartedAt,
    retrievalEnabled,
  } = args;
  const promptArgs: PromptArgs = args.promptMessageId
    ? args.prompt !== undefined
      ? {
          promptMessageId: args.promptMessageId,
          prompt: args.prompt as Array<ModelMessage>,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
        }
      : { promptMessageId: args.promptMessageId, maxOutputTokens: MAX_OUTPUT_TOKENS }
    : { prompt: args.prompt!, maxOutputTokens: MAX_OUTPUT_TOKENS };

  return runInRunSpan(
    {
      userId,
      threadId,
      source,
      provider,
      environment,
      release,
      promptVersion,
      hasImages,
      isByok,
    },
    async (span) => {
      const runId = span.runId;
      const telemetry: TelemetryArgs = {
        runId,
        userId,
        threadId,
        provider,
        source,
        environment,
        release,
        promptVersion,
        hasImages,
        isByok,
      };

      const accInit: AccumulatorInit = {
        runId,
        userId: userId as Id<"users">,
        threadId,
        messageId: args.promptMessageId,
        source,
        environment,
        release,
        promptVersion,
        startedAt: Date.now(),
        scheduledAt,
        processingStartedAt,
        retrievalEnabled,
      };
      const accumulator = new RunAccumulator(accInit);

      const errorReport = { threadId, userId, isByok, provider };

      const runAttempt = async (agent: Agent): Promise<AttemptOutcome> => {
        try {
          await attemptStream({ ctx, agent, promptArgs, telemetry, accumulator });
          return { done: true, success: true };
        } catch (error) {
          if (await safeTryReportByok(ctx, { ...errorReport, error })) {
            const cls = classifyByokError(error) ?? "byok_unknown_error";
            accumulator.setTerminalErrorClass(cls);
            span.recordError(cls);
            return { done: true, success: false };
          }
          if (isQuotaError(error) || !isTransientError(error)) {
            const cls = errorClassName(error);
            accumulator.setTerminalErrorClass(cls);
            span.recordError(cls);
            await safeReportError(ctx, { ...errorReport, error });
            return { done: true, success: false };
          }
          return { done: false, error };
        }
      };

      await runWithPrimaryCircuitBreaker({
        ctx,
        primaryAgent,
        fallbackAgent,
        primaryModelName,
        provider,
        runId,
        threadId,
        userId,
        accumulator,
        retryDelayMs: RETRY_DELAY_MS,
        runAttempt,
        finalizePending: (reason) => safeFinalizePending(ctx, threadId, reason),
        recordTerminalError: async (error) => {
          const cls = errorClassName(error);
          accumulator.setTerminalErrorClass(cls);
          span.recordError(cls);
          await safeReportError(ctx, { ...errorReport, error });
        },
      });
      return accumulator;
    },
  );
}

function errorClassName(error: unknown): string {
  if (error instanceof Error) return error.name;
  return "Unknown";
}

interface TelemetryArgs {
  runId: string;
  userId: string;
  threadId: string;
  provider: ProviderId;
  source: "chat" | "approval_continuation";
  environment: "dev" | "prod";
  release?: string;
  promptVersion?: string;
  hasImages?: boolean;
  isByok: boolean;
}

interface AttemptStreamOptions {
  ctx: ActionCtx;
  agent: Agent;
  promptArgs: PromptArgs;
  telemetry: TelemetryArgs;
  accumulator: RunAccumulator;
}

async function attemptStream({
  ctx,
  agent,
  promptArgs,
  telemetry,
  accumulator,
}: AttemptStreamOptions): Promise<void> {
  const { threadId, userId } = telemetry;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("Stream timeout"), ATTEMPT_TIMEOUT_MS);
  let budgetTrip: BudgetCapTrip | undefined;
  try {
    const { thread } = await agent.continueThread(ctx, { threadId, userId });
    const stopWhen = telemetry.isByok
      ? [
          stepCountIs(COACH_MAX_STEPS),
          budgetCapStopCondition(telemetry.provider, (trip) => {
            budgetTrip = trip;
          }),
        ]
      : stepCountIs(COACH_MAX_STEPS);
    const result = await thread.streamText(
      {
        ...promptArgs,
        abortSignal: controller.signal,
        stopWhen,
        experimental_telemetry: buildTelemetryConfig(telemetry),
        experimental_context: { runId: telemetry.runId },
        onChunk: (event: { chunk: { type: string } }) => {
          try {
            if (event.chunk.type === "text-delta") accumulator.markFirstChunk();
          } catch {
            // Telemetry must never fail the LLM turn.
          }
        },
        onStepFinish: (step: StepResult<ToolSet>) => {
          try {
            accumulator.onStepFinish(step);
          } catch {
            // Telemetry must never fail the LLM turn.
          }
        },
        onFinish: () => {
          try {
            accumulator.markFinished();
          } catch {
            // Telemetry must never fail the LLM turn.
          }
        },
      },
      STREAM_OPTIONS,
    );
    await result.text;

    if (budgetTrip) {
      await ctx.runMutation(internal.aiUsage.recordBudgetStop, {
        userId: userId as Id<"users">,
        threadId,
        provider: telemetry.provider,
        model: budgetTrip.modelId ?? "unknown",
      });
      await saveMessage(ctx, components.agent, {
        threadId,
        userId,
        message: { role: "assistant", content: BUDGET_CAP_MESSAGE },
      });
    }
  } finally {
    clearTimeout(timeout);
  }
}

// Raw inputs/outputs go to Phoenix Cloud for conversation capture. BYOK keys
// and Tonal tokens are sanitized upstream in byokErrors/chatHelpers so AI SDK
// messages never carry secrets by the time they reach this layer.
function buildTelemetryConfig(telemetry: TelemetryArgs): TelemetrySettings {
  const metadata: Record<string, string | boolean> = {
    runId: telemetry.runId,
    threadId: telemetry.threadId,
    userId: telemetry.userId,
    provider: telemetry.provider,
    source: telemetry.source,
    environment: telemetry.environment,
    isByok: telemetry.isByok,
  };
  if (telemetry.release) metadata.release = telemetry.release;
  if (telemetry.promptVersion) metadata.promptVersion = telemetry.promptVersion;
  if (typeof telemetry.hasImages === "boolean") metadata.hasImages = telemetry.hasImages;

  return {
    isEnabled: true,
    functionId: "coach-agent",
    recordInputs: true,
    recordOutputs: true,
    metadata,
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
    paginationOpts: { cursor: null, numItems: 50 },
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

// Best-effort wrappers — failure inside cleanup/reporting must never escape
// runInRunSpan or the user is left with a stuck pending message.
const safeFinalizePending = (ctx: ActionCtx, threadId: string, reason: string) =>
  finalizePendingMessages(ctx, threadId, reason).catch(() => undefined);
const safeReportError = (ctx: ActionCtx, report: ErrorReport) =>
  reportError(ctx, report).catch(() => undefined);
const safeTryReportByok = (ctx: ActionCtx, report: ErrorReport) =>
  tryReportByok(ctx, report).catch(() => false);

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
  const transientKind = classifyTransientError(report.error);
  const content = transientKind
    ? buildProviderTransientMessage(transientKind, report.provider, report.isByok)
    : AI_ERROR_MESSAGE;

  // Raw AI provider messages stored on the failed record appear in Sentry. Use
  // the transient kind or error.name so events don't contain raw AI provider text.
  const finalizeCode =
    transientKind ?? (report.error instanceof Error ? report.error.name : "unknown_error");
  await finalizePendingMessages(ctx, report.threadId, finalizeCode);

  await saveMessage(ctx, components.agent, {
    threadId: report.threadId,
    userId: report.userId,
    message: { role: "assistant", content },
  });

  // Upstream provider outages already surface to the user with an attributed
  // message; paging Discord on every Gemini/Claude capacity blip is noise.
  if (transientKind) return;

  const reason = report.error instanceof Error ? report.error.message : String(report.error);
  await ctx.runAction(internal.discord.notifyError, {
    source: "streamWithRetry",
    message: reason,
    userId: report.userId,
  });
}
