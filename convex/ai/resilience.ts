"use node";

// Node runtime required: this module imports ./otel, which loads
// @arizeai/phoenix-otel → @opentelemetry/sdk-trace-node → context-async-hooks's
// require("async_hooks"). Marking it "use node" keeps the Convex bundler
// from trying to ship async_hooks into the V8 isolate.

import type { Agent } from "@convex-dev/agent";
import type { ModelMessage } from "@ai-sdk/provider-utils";
import { saveMessage } from "@convex-dev/agent";
import type { StepResult, TelemetrySettings, ToolSet } from "ai";
import { components, internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { type ProviderId } from "./providers";
import { type AccumulatorInit, RunAccumulator } from "./runTelemetry";
import { buildByokErrorMessage, classifyByokError } from "./byokErrors";
import { runInRunSpan } from "./otel";
import {
  buildProviderTransientMessage,
  classifyTransientError,
  isTransientError,
} from "./transientErrors";

// Re-export for backwards compatibility with existing callers/tests.
export { buildByokErrorMessage, classifyByokError, withByokErrorSanitization } from "./byokErrors";
export type { ByokErrorCode } from "./byokErrors";
export { isTransientError } from "./transientErrors";

const AI_ERROR_MESSAGE = "I'm having trouble right now. Please try again in a moment.";
const MAX_OUTPUT_TOKENS = 4096;
const RETRY_DELAY_MS = 3000;

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
  /** Distinguishes a fresh user message from an approval-continuation turn. */
  source: "chat" | "approval_continuation";
  /** Deployment environment — surfaces in dashboards to slice dev vs prod. */
  environment: "dev" | "prod";
  /** Vercel commit SHA when available. */
  release?: string;
  /** Hash of STATIC_INSTRUCTIONS; lets us correlate prompt changes to metrics. */
  promptVersion?: string;
  /** True when the user attached at least one image to this turn. */
  hasImages?: boolean;
  /** Server-side enqueue timestamp from the mutation that scheduled this action. */
  scheduledAt?: number;
  /** Timestamp captured at processMessage handler entry. */
  processingStartedAt?: number;
  /** Whether semantic cross-thread retrieval was enabled for this turn. */
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

type AttemptOutcome = { done: true } | { done: false; error: unknown };

export async function streamWithRetry(
  ctx: ActionCtx,
  args: StreamWithRetryArgs,
): Promise<RunAccumulator> {
  const {
    primaryAgent,
    fallbackAgent,
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
      // runId matches the Phoenix trace id so `aiRun.runId` joins to Phoenix traces.
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
          return { done: true };
        } catch (error) {
          if (await tryReportByok(ctx, { ...errorReport, error })) {
            const cls = classifyByokError(error) ?? "byok_unknown_error";
            accumulator.setTerminalErrorClass(cls);
            span.recordError(cls);
            return { done: true };
          }
          if (!isTransientError(error)) {
            const cls = errorClassName(error);
            accumulator.setTerminalErrorClass(cls);
            span.recordError(cls);
            await reportError(ctx, { ...errorReport, error });
            return { done: true };
          }
          return { done: false, error };
        }
      };

      if ((await runAttempt(primaryAgent)).done) return accumulator;
      accumulator.markRetry();
      await delay(RETRY_DELAY_MS);
      if ((await runAttempt(primaryAgent)).done) return accumulator;
      accumulator.markRetry();

      accumulator.markFallback("transient_exhaustion");
      const final = await runAttempt(fallbackAgent);
      if (final.done) return accumulator;
      // Fallback also hit a transient error. Classify it, record the terminal
      // class on the accumulator + span, then hand off to reportError — which
      // surfaces a provider-attributed message for transient outages and falls
      // back to the generic "trouble right now" message otherwise.
      const cls = errorClassName(final.error);
      accumulator.setTerminalErrorClass(cls);
      span.recordError(cls);
      await reportError(ctx, { ...errorReport, error: final.error });
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
  try {
    const { thread } = await agent.continueThread(ctx, { threadId, userId });
    const result = await thread.streamText(
      {
        ...promptArgs,
        abortSignal: controller.signal,
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

  const transientKind = classifyTransientError(report.error);
  const content = transientKind
    ? buildProviderTransientMessage(transientKind, report.provider)
    : AI_ERROR_MESSAGE;

  await saveMessage(ctx, components.agent, {
    threadId: report.threadId,
    userId: report.userId,
    message: { role: "assistant", content },
  });

  // Upstream provider outages already surface to the user with an attributed
  // message; paging Discord on every Gemini/Claude capacity blip is noise.
  if (transientKind) return;

  await ctx.runAction(internal.discord.notifyError, {
    source: "streamWithRetry",
    message: reason,
    userId: report.userId,
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
