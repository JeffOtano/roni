import { describe, expect, it } from "vitest";
import type { StepResult, ToolSet } from "ai";
import { type AccumulatorInit, RunAccumulator } from "./runTelemetry";
import type { Id } from "../_generated/dataModel";

const USER_ID = "k5762r1m174t2cmjgb9178ptk582y3p6" as Id<"users">;
const RUN_ID = "1049455d-e028-452c-94b2-2b6ef905ba4d";
const THREAD_ID = "thread-abc";

function baseInit(overrides: Partial<AccumulatorInit> = {}): AccumulatorInit {
  return {
    runId: RUN_ID,
    userId: USER_ID,
    threadId: THREAD_ID,
    messageId: "msg-1",
    source: "chat",
    environment: "dev",
    startedAt: 1_700_000_000_000,
    ...overrides,
  };
}

// Partial StepResult — the accumulator only reads specific fields, and the
// full type is huge and tangled with generic tool sets. A narrow shape keeps
// tests focused and avoids coupling to SDK internals.
function buildStep(partial: {
  stepNumber?: number;
  modelId?: string;
  provider?: string;
  finishReason?: StepResult<ToolSet>["finishReason"];
  toolCalls?: Array<{ toolName: string }>;
  toolResults?: Array<{ toolName: string; output: unknown }>;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
  };
}): StepResult<ToolSet> {
  return {
    stepNumber: partial.stepNumber ?? 0,
    model: {
      provider: partial.provider ?? "gemini",
      modelId: partial.modelId ?? "gemini-3-flash-preview",
    },
    toolCalls: (partial.toolCalls ?? []) as StepResult<ToolSet>["toolCalls"],
    toolResults: (partial.toolResults ?? []) as StepResult<ToolSet>["toolResults"],
    finishReason: partial.finishReason ?? "stop",
    usage: {
      inputTokens: partial.usage?.inputTokens ?? 0,
      outputTokens: partial.usage?.outputTokens ?? 0,
      totalTokens: (partial.usage?.inputTokens ?? 0) + (partial.usage?.outputTokens ?? 0),
      inputTokenDetails: {
        cacheReadTokens: partial.usage?.cacheReadTokens ?? 0,
        cacheWriteTokens: partial.usage?.cacheWriteTokens ?? 0,
      },
    },
  } as unknown as StepResult<ToolSet>;
}

describe("RunAccumulator", () => {
  it("initializes zeroed aggregates", () => {
    const acc = new RunAccumulator(baseInit());
    const row = acc.toRow();

    expect(row.runId).toBe(RUN_ID);
    expect(row.userId).toBe(USER_ID);
    expect(row.threadId).toBe(THREAD_ID);
    expect(row.messageId).toBe("msg-1");
    expect(row.source).toBe("chat");
    expect(row.environment).toBe("dev");
    expect(row.totalSteps).toBe(0);
    expect(row.toolSequence).toEqual([]);
    expect(row.retryCount).toBe(0);
    expect(row.inputTokens).toBe(0);
    expect(row.outputTokens).toBe(0);
    expect(row.cacheReadTokens).toBe(0);
    expect(row.cacheWriteTokens).toBe(0);
    expect(row.approvalPauses).toBe(0);
    expect(row.fallbackReason).toBeUndefined();
    expect(row.finishReason).toBeUndefined();
    expect(row.workoutPlanCreatedId).toBeUndefined();
    expect(row.workoutPushOutcome).toBeUndefined();
  });

  it("accumulates tokens, model, finish reason, and tool sequence across steps", () => {
    const acc = new RunAccumulator(baseInit());

    acc.onStepFinish(
      buildStep({
        stepNumber: 0,
        provider: "gemini",
        modelId: "gemini-3-flash-preview",
        finishReason: "tool-calls",
        toolCalls: [{ toolName: "search_exercises" }, { toolName: "get_workout_history" }],
        usage: { inputTokens: 120, outputTokens: 40, cacheReadTokens: 15 },
      }),
    );
    acc.onStepFinish(
      buildStep({
        stepNumber: 1,
        provider: "gemini",
        modelId: "gemini-3-flash-preview",
        finishReason: "stop",
        toolCalls: [],
        usage: { inputTokens: 80, outputTokens: 20, cacheReadTokens: 10, cacheWriteTokens: 5 },
      }),
    );

    const row = acc.toRow();
    expect(row.totalSteps).toBe(2);
    expect(row.toolSequence).toEqual(["search_exercises", "get_workout_history"]);
    expect(row.inputTokens).toBe(200);
    expect(row.outputTokens).toBe(60);
    expect(row.cacheReadTokens).toBe(25);
    expect(row.cacheWriteTokens).toBe(5);
    expect(row.finishReason).toBe("stop"); // latest step wins
    expect(row.modelId).toBe("gemini-3-flash-preview");
    expect(row.provider).toBe("gemini");
  });

  it("increments retry count and records fallback reason", () => {
    const acc = new RunAccumulator(baseInit());
    acc.markRetry();
    acc.markRetry();
    acc.markFallback("transient_exhaustion");

    const row = acc.toRow();
    expect(row.retryCount).toBe(2);
    expect(row.fallbackReason).toBe("transient_exhaustion");
  });

  it("captures terminal error class and normalizes unknown finish reason", () => {
    const acc = new RunAccumulator(baseInit());
    acc.setTerminalErrorClass("AI_APICallError");
    acc.onStepFinish(
      buildStep({
        // Cast unsafe value to simulate a provider returning an unusual finish reason.
        finishReason: "weird-reason" as unknown as StepResult<ToolSet>["finishReason"],
      }),
    );

    const row = acc.toRow();
    expect(row.terminalErrorClass).toBe("AI_APICallError");
    // Unknown finish reasons collapse to "other" so the validator accepts them.
    expect(row.finishReason).toBe("other");
  });

  it("extracts workoutPlanCreatedId from a successful create_workout tool result", () => {
    const planId = "p_workoutplan_abc123" as unknown as Id<"workoutPlans">;
    const acc = new RunAccumulator(baseInit());
    acc.onStepFinish(
      buildStep({
        toolCalls: [{ toolName: "create_workout" }],
        toolResults: [
          {
            toolName: "create_workout",
            output: {
              success: true,
              workoutId: "tonal-id-123",
              title: "Upper Body Strength",
              setCount: 18,
              planId,
            },
          },
        ],
      }),
    );

    expect(acc.toRow().workoutPlanCreatedId).toBe(planId);
  });

  it("ignores failed create_workout results", () => {
    const acc = new RunAccumulator(baseInit());
    acc.onStepFinish(
      buildStep({
        toolCalls: [{ toolName: "create_workout" }],
        toolResults: [
          {
            toolName: "create_workout",
            output: { success: false, error: "Invalid movementIds" },
          },
        ],
      }),
    );

    expect(acc.toRow().workoutPlanCreatedId).toBeUndefined();
  });

  it("sets workoutPushOutcome to 'pushed' when approve_week_plan succeeds fully", () => {
    const acc = new RunAccumulator(baseInit());
    acc.onStepFinish(
      buildStep({
        toolCalls: [{ toolName: "approve_week_plan" }],
        toolResults: [
          {
            toolName: "approve_week_plan",
            output: { success: true, pushed: 3, failed: 0, skipped: 0, results: [] },
          },
        ],
      }),
    );

    expect(acc.toRow().workoutPushOutcome).toBe("pushed");
  });

  it("sets workoutPushOutcome to 'failed' when approve_week_plan reports failures", () => {
    const acc = new RunAccumulator(baseInit());
    acc.onStepFinish(
      buildStep({
        toolCalls: [{ toolName: "approve_week_plan" }],
        toolResults: [
          {
            toolName: "approve_week_plan",
            output: { success: false, pushed: 1, failed: 2, skipped: 0, results: [] },
          },
        ],
      }),
    );

    expect(acc.toRow().workoutPushOutcome).toBe("failed");
  });

  it("tracks approval pauses and persists them on the row", () => {
    const acc = new RunAccumulator(baseInit());
    acc.markApprovalPause();
    acc.markApprovalPause();

    expect(acc.toRow().approvalPauses).toBe(2);
  });

  it("increments approvalPauses on a successful create_workout tool result", () => {
    const planId = "p_workoutplan_xyz" as unknown as Id<"workoutPlans">;
    const acc = new RunAccumulator(baseInit());
    acc.onStepFinish(
      buildStep({
        toolCalls: [{ toolName: "create_workout" }],
        toolResults: [
          {
            toolName: "create_workout",
            output: {
              success: true,
              workoutId: "w1",
              title: "Chest",
              setCount: 9,
              planId,
            },
          },
        ],
      }),
    );

    expect(acc.toRow().approvalPauses).toBe(1);
  });

  it("increments approvalPauses on a successful program_week tool result", () => {
    const acc = new RunAccumulator(baseInit());
    acc.onStepFinish(
      buildStep({
        toolCalls: [{ toolName: "program_week" }],
        toolResults: [{ toolName: "program_week", output: { success: true, weekPlanId: "w_abc" } }],
      }),
    );

    expect(acc.toRow().approvalPauses).toBe(1);
  });

  it("records TTFT, TTLT, and throughput when the stream emits tokens", () => {
    const acc = new RunAccumulator(baseInit({ startedAt: 1_000_000 }));
    acc.onStepFinish(
      buildStep({
        finishReason: "stop",
        usage: { inputTokens: 10, outputTokens: 100 },
      }),
    );
    acc.markFirstChunk(1_000_200); // 200ms TTFT
    acc.markFinished(1_001_200); // 1200ms TTLT
    const row = acc.toRow();

    expect(row.timeToFirstTokenMs).toBe(200);
    expect(row.timeToLastTokenMs).toBe(1200);
    // 100 tokens streamed over 1000ms between first chunk and finish = 100 tok/s
    expect(row.outputTokensPerSec).toBeCloseTo(100, 5);
  });

  it("records queue, setup, total token timing, retrieval, and context metrics", () => {
    const acc = new RunAccumulator(
      baseInit({
        scheduledAt: 900_000,
        processingStartedAt: 901_500,
        startedAt: 903_000,
        retrievalEnabled: false,
      }),
    );

    acc.setContextTiming({
      contextBuildMs: 40,
      snapshotBuildMs: 15,
      contextBuildCount: 1,
      contextMessageCount: 6,
      snapshotSource: "coach_state_fresh",
    });
    acc.markFirstChunk(903_250);
    acc.markFinished(904_000);
    const row = acc.toRow();

    expect(row.queueDelayMs).toBe(1500);
    expect(row.preStreamSetupMs).toBe(1500);
    expect(row.timeToFirstTokenMs).toBe(250);
    expect(row.totalTimeToFirstTokenMs).toBe(3250);
    expect(row.totalTimeToLastTokenMs).toBe(4000);
    expect(row.retrievalEnabled).toBe(false);
    expect(row.contextBuildMs).toBe(40);
    expect(row.snapshotBuildMs).toBe(15);
    expect(row.contextBuildCount).toBe(1);
    expect(row.contextMessageCount).toBe(6);
    expect(row.snapshotSource).toBe("coach_state_fresh");
  });

  it("ignores additional markFirstChunk calls after the first one", () => {
    const acc = new RunAccumulator(baseInit({ startedAt: 1_000_000 }));
    acc.markFirstChunk(1_000_200);
    acc.markFirstChunk(1_000_500); // second call ignored
    expect(acc.toRow().timeToFirstTokenMs).toBe(200);
  });

  it("leaves totalCostUsd undefined because per-model cost is not modeled today", () => {
    const acc = new RunAccumulator(baseInit());
    expect(acc.toRow().totalCostUsd).toBeUndefined();
  });

  it("uses approval_continuation source when configured and preserves messageId undefined", () => {
    const acc = new RunAccumulator(
      baseInit({ source: "approval_continuation", messageId: undefined }),
    );

    const row = acc.toRow();
    expect(row.source).toBe("approval_continuation");
    expect(row.messageId).toBeUndefined();
  });
});
