import type { Agent } from "@convex-dev/agent";
import { makeFunctionReference } from "convex/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { estimateAttemptCostUsd } from "./circuitBreakerCore";
import type { ProviderId } from "./providers";
import type { AttemptUsageSnapshot, RunAccumulator } from "./runTelemetry";

const reservePrimaryAttemptRef = makeFunctionReference<
  "mutation",
  { provider: ProviderId; runId: string; userId?: Id<"users">; threadId?: string },
  {
    route: "primary" | "fallback";
    reason: "closed" | "open_circuit" | "half_open_probe" | "half_open_busy";
  }
>("ai/circuitBreaker:reservePrimaryAttempt");

const recordPrimaryAttemptFailureRef = makeFunctionReference<
  "mutation",
  {
    provider: ProviderId;
    runId: string;
    userId?: Id<"users">;
    threadId?: string;
    model: string;
    totalCostUsd?: number;
    errorClass: string;
  },
  {
    opened: boolean;
    openReason: "error_threshold" | "cost_threshold" | "half_open_failure" | null;
    recentFailures: number;
    recentFailedCostUsd: number;
  }
>("ai/circuitBreaker:recordPrimaryAttemptFailure");

const recordPrimaryAttemptSuccessRef = makeFunctionReference<
  "mutation",
  {
    provider: ProviderId;
    runId: string;
    userId?: Id<"users">;
    threadId?: string;
    model: string;
  },
  { closed: boolean }
>("ai/circuitBreaker:recordPrimaryAttemptSuccess");

export type AttemptOutcome =
  | { done: true; success: true }
  | { done: true; success: false }
  | { done: false; error: unknown };

interface CircuitBreakerFlowArgs {
  ctx: ActionCtx;
  primaryAgent: Agent;
  fallbackAgent: Agent;
  primaryModelName: string;
  provider: ProviderId;
  runId: string;
  threadId: string;
  userId: string;
  accumulator: RunAccumulator;
  retryDelayMs: number;
  runAttempt: (agent: Agent) => Promise<AttemptOutcome>;
  finalizePending: (reason: string) => Promise<void>;
  recordTerminalError: (error: unknown) => Promise<void>;
}

export async function runWithPrimaryCircuitBreaker(args: CircuitBreakerFlowArgs): Promise<void> {
  const {
    ctx,
    primaryAgent,
    fallbackAgent,
    primaryModelName,
    provider,
    runId,
    threadId,
    userId,
    accumulator,
    retryDelayMs,
    runAttempt,
    finalizePending,
    recordTerminalError,
  } = args;
  const breakerUserId = userId as Id<"users">;

  const notifyBreakerOpened = async (details: {
    openReason: "error_threshold" | "cost_threshold" | "half_open_failure";
    recentFailures: number;
    recentFailedCostUsd: number;
  }) => {
    await ctx.runAction(internal.discord.notifyError, {
      source: "aiCircuitBreaker",
      message: `Opened ${provider} circuit breaker (${details.openReason}) after ${details.recentFailures} failed primary attempts and $${details.recentFailedCostUsd.toFixed(2)} of failed spend in the last 60s`,
      userId,
    });
  };

  const recordPrimaryFailure = async (failure: {
    error: unknown;
    snapshot: AttemptUsageSnapshot;
  }) => {
    const usage = accumulator.usageDeltaSince(failure.snapshot);
    const model = usage.modelId ?? primaryModelName;
    const totalCostUsd = estimateAttemptCostUsd({
      provider,
      model,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cacheReadTokens: usage.cacheReadTokens,
      cacheWriteTokens: usage.cacheWriteTokens,
    });
    const result: {
      opened: boolean;
      openReason: "error_threshold" | "cost_threshold" | "half_open_failure" | null;
      recentFailures: number;
      recentFailedCostUsd: number;
    } = await ctx.runMutation(recordPrimaryAttemptFailureRef, {
      provider,
      runId,
      userId: breakerUserId,
      threadId,
      model,
      totalCostUsd,
      errorClass: errorClassName(failure.error),
    });
    if (result.opened && result.openReason) {
      await notifyBreakerOpened({
        openReason: result.openReason,
        recentFailures: result.recentFailures,
        recentFailedCostUsd: result.recentFailedCostUsd,
      });
    }
    return result;
  };

  const routeDecision: {
    route: "primary" | "fallback";
    reason: "closed" | "open_circuit" | "half_open_probe" | "half_open_busy";
  } = await ctx.runMutation(reservePrimaryAttemptRef, {
    provider,
    runId,
    userId: breakerUserId,
    threadId,
  });

  if (routeDecision.route === "fallback") {
    accumulator.markFallback("circuit_open");
    const final = await runAttempt(fallbackAgent);
    if (!final.done) {
      await recordTerminalError(final.error);
    }
    return;
  }

  const isHalfOpenProbe = routeDecision.reason === "half_open_probe";
  const firstAttemptSnapshot = accumulator.snapshotUsage();
  const firstAttempt = await runAttempt(primaryAgent);
  if (firstAttempt.done) {
    if (isHalfOpenProbe) {
      const finalUsage = accumulator.snapshotUsage();
      if (firstAttempt.success) {
        await ctx.runMutation(recordPrimaryAttemptSuccessRef, {
          provider,
          runId,
          userId: breakerUserId,
          threadId,
          model: finalUsage.modelId ?? primaryModelName,
        });
      } else {
        const failure = await ctx.runMutation(recordPrimaryAttemptFailureRef, {
          provider,
          runId,
          userId: breakerUserId,
          threadId,
          model: finalUsage.modelId ?? primaryModelName,
          errorClass: "TerminalPrimaryAttemptFailure",
        });
        if (failure.opened && failure.openReason) {
          await notifyBreakerOpened({
            openReason: failure.openReason,
            recentFailures: failure.recentFailures,
            recentFailedCostUsd: failure.recentFailedCostUsd,
          });
        }
      }
    }
    return;
  }

  const firstFailure = await recordPrimaryFailure({
    error: firstAttempt.error,
    snapshot: firstAttemptSnapshot,
  });
  if (firstFailure.opened) {
    await finalizePending("transient_retry");
    accumulator.markFallback("circuit_open");
    const final = await runAttempt(fallbackAgent);
    if (!final.done) {
      await recordTerminalError(final.error);
    }
    return;
  }

  await finalizePending("transient_retry");
  accumulator.markRetry();
  await delay(retryDelayMs);

  const secondAttemptSnapshot = accumulator.snapshotUsage();
  const secondAttempt = await runAttempt(primaryAgent);
  if (secondAttempt.done) return;

  const secondFailure = await recordPrimaryFailure({
    error: secondAttempt.error,
    snapshot: secondAttemptSnapshot,
  });
  await finalizePending("transient_retry");
  accumulator.markRetry();
  accumulator.markFallback(secondFailure.opened ? "circuit_open" : "transient_exhaustion");

  const final = await runAttempt(fallbackAgent);
  if (!final.done) {
    await recordTerminalError(final.error);
  }
}

function errorClassName(error: unknown): string {
  if (error instanceof Error) return error.name;
  return "Unknown";
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
