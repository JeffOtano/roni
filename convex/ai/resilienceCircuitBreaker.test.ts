import type { Agent } from "@convex-dev/agent";
import { describe, expect, it, vi } from "vitest";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { runWithPrimaryCircuitBreaker } from "./resilienceCircuitBreaker";
import type { RunAccumulator } from "./runTelemetry";

describe("runWithPrimaryCircuitBreaker", () => {
  it("records a terminal half-open probe failure before returning", async () => {
    let mutationCalls = 0;
    const runMutation = vi.fn(async (_ref: unknown, _args: Record<string, unknown>) => {
      mutationCalls += 1;
      if (mutationCalls === 1) {
        return {
          route: "primary",
          reason: "half_open_probe",
        };
      }
      return {
        opened: true,
        openReason: "half_open_failure",
        recentFailures: 1,
        recentFailedCostUsd: 0,
      };
    });
    const ctx = {
      runMutation,
      runAction: vi.fn(async () => undefined),
    } as unknown as ActionCtx;
    const accumulator = {
      snapshotUsage: vi.fn(() => ({
        inputTokens: 10,
        outputTokens: 2,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        modelId: "gemini-3-flash-preview",
      })),
    } as unknown as RunAccumulator;
    const runAttempt = vi.fn(async () => ({ done: true, success: false }) as const);
    const finalizePending = vi.fn(async () => undefined);
    const recordTerminalError = vi.fn(async () => undefined);

    await runWithPrimaryCircuitBreaker({
      ctx,
      primaryAgent: {} as Agent,
      fallbackAgent: {} as Agent,
      primaryModelName: "gemini-3-flash-preview",
      provider: "gemini",
      runId: "run-1",
      threadId: "thread-1",
      userId: "user-1",
      accumulator,
      retryDelayMs: 1,
      runAttempt,
      finalizePending,
      recordTerminalError,
    });

    expect(runAttempt).toHaveBeenCalledTimes(1);
    expect(runMutation).toHaveBeenCalledTimes(2);
    expect(runMutation.mock.calls[1]?.[1]).toMatchObject({
      provider: "gemini",
      runId: "run-1",
      userId: "user-1" as Id<"users">,
      threadId: "thread-1",
      model: "gemini-3-flash-preview",
      errorClass: "TerminalPrimaryAttemptFailure",
    });
    expect(ctx.runAction).toHaveBeenCalledTimes(1);
    expect(finalizePending).not.toHaveBeenCalled();
    expect(recordTerminalError).not.toHaveBeenCalled();
  });
});
