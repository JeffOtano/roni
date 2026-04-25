import type { StepResult, ToolSet } from "ai";
import type { Id } from "../_generated/dataModel";

/** Row shape produced by `RunAccumulator.toRow()`. Matches the `aiRun` table validator. */
export interface AiRunRow {
  runId: string;
  userId: Id<"users">;
  threadId: string;
  messageId?: string;
  source: "chat" | "approval_continuation";
  environment: "dev" | "prod";
  release?: string;
  promptVersion?: string;
  totalSteps: number;
  toolSequence: string[];
  retryCount: number;
  fallbackReason?: "transient_exhaustion" | "primary_error";
  finishReason?:
    | "stop"
    | "tool-calls"
    | "length"
    | "content-filter"
    | "error"
    | "other"
    | "unknown";
  terminalErrorClass?: string;
  modelId?: string;
  provider?: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalCostUsd?: number;
  scheduledAt?: number;
  processingStartedAt?: number;
  streamStartedAt?: number;
  queueDelayMs?: number;
  preStreamSetupMs?: number;
  timeToFirstTokenMs?: number;
  timeToLastTokenMs?: number;
  totalTimeToFirstTokenMs?: number;
  totalTimeToLastTokenMs?: number;
  outputTokensPerSec?: number;
  contextBuildMs?: number;
  snapshotBuildMs?: number;
  contextBuildCount?: number;
  contextMessageCount?: number;
  snapshotSource?: "coach_state_fresh" | "coach_state_stale" | "live_rebuild";
  retrievalEnabled?: boolean;
  approvalPauses: number;
  workoutPlanCreatedId?: Id<"workoutPlans">;
  workoutPushOutcome?: "pushed" | "failed" | "none";
  createdAt: number;
}

export interface AccumulatorInit {
  runId: string;
  userId: Id<"users">;
  threadId: string;
  messageId?: string;
  source: "chat" | "approval_continuation";
  environment: "dev" | "prod";
  release?: string;
  promptVersion?: string;
  scheduledAt?: number;
  processingStartedAt?: number;
  retrievalEnabled?: boolean;
  /** Turn start timestamp in ms. Defaults to `Date.now()`; injectable for tests. */
  startedAt?: number;
}

export interface ContextTimingMetrics {
  contextBuildMs?: number;
  snapshotBuildMs?: number;
  contextBuildCount?: number;
  contextMessageCount?: number;
  snapshotSource?: AiRunRow["snapshotSource"];
}

const ALLOWED_FINISH_REASONS = new Set<AiRunRow["finishReason"]>([
  "stop",
  "tool-calls",
  "length",
  "content-filter",
  "error",
  "other",
  "unknown",
]);

/** Coerce the SDK's finishReason into the enum the aiRun validator accepts. */
function normalizeFinishReason(raw: StepResult<ToolSet>["finishReason"]): AiRunRow["finishReason"] {
  return ALLOWED_FINISH_REASONS.has(raw as AiRunRow["finishReason"])
    ? (raw as AiRunRow["finishReason"])
    : "other";
}

type CreateWorkoutOutput =
  | {
      success: true;
      workoutId: string;
      title: string;
      setCount: number;
      planId: Id<"workoutPlans">;
    }
  | { success: false; error: string; planId?: Id<"workoutPlans"> };

type ApproveWeekPlanOutput =
  | { success: boolean; pushed: number; failed: number; skipped: number; results: unknown[] }
  | { error: string };

function isCreateWorkoutOutput(value: unknown): value is CreateWorkoutOutput {
  if (!value || typeof value !== "object") return false;
  return "success" in value && typeof (value as { success: unknown }).success === "boolean";
}

function isApproveWeekPlanOutput(value: unknown): value is ApproveWeekPlanOutput {
  if (!value || typeof value !== "object") return false;
  return "pushed" in value || "failed" in value || "error" in value;
}

/**
 * Per-turn accumulator for the `aiRun` telemetry row.
 *
 * Wraps a single user turn (primary attempt, retry, optional fallback) and
 * collects: tokens, tool sequence, finish reason, retry/fallback state, and
 * Roni-specific outcomes (workout plan created, week plan push result).
 *
 * Not thread-safe; instantiated once per turn in `streamWithRetry` and
 * persisted in the caller's `finally` block.
 */
export class RunAccumulator {
  private totalSteps = 0;
  private readonly toolSequence: string[] = [];
  private retryCount = 0;
  private fallbackReason?: AiRunRow["fallbackReason"];
  private finishReason?: AiRunRow["finishReason"];
  private terminalErrorClass?: string;
  private modelId?: string;
  private provider?: string;
  private inputTokens = 0;
  private outputTokens = 0;
  private cacheReadTokens = 0;
  private cacheWriteTokens = 0;
  private approvalPauses = 0;
  private workoutPlanCreatedId?: Id<"workoutPlans">;
  private workoutPushOutcome?: AiRunRow["workoutPushOutcome"];
  private readonly startedAt: number;
  private readonly scheduledAt?: number;
  private readonly processingStartedAt?: number;
  private readonly retrievalEnabled?: boolean;
  private timeToFirstTokenMs?: number;
  private timeToLastTokenMs?: number;
  private totalTimeToFirstTokenMs?: number;
  private totalTimeToLastTokenMs?: number;
  private outputTokensPerSec?: number;
  private contextBuildMs?: number;
  private snapshotBuildMs?: number;
  private contextBuildCount?: number;
  private contextMessageCount?: number;
  private snapshotSource?: AiRunRow["snapshotSource"];

  constructor(private readonly init: AccumulatorInit) {
    this.startedAt = init.startedAt ?? Date.now();
    this.scheduledAt = init.scheduledAt;
    this.processingStartedAt = init.processingStartedAt;
    this.retrievalEnabled = init.retrievalEnabled;
  }

  /** First text delta from the model — used for TTFT. Ignored after the first call. */
  markFirstChunk(now: number = Date.now()): void {
    if (this.timeToFirstTokenMs !== undefined) return;
    this.timeToFirstTokenMs = Math.max(0, now - this.startedAt);
    if (this.scheduledAt !== undefined) {
      this.totalTimeToFirstTokenMs = Math.max(0, now - this.scheduledAt);
    }
  }

  /** Called once from `onFinish`. Records TTLT and throughput when possible. */
  markFinished(now: number = Date.now()): void {
    this.timeToLastTokenMs = Math.max(0, now - this.startedAt);
    if (this.scheduledAt !== undefined) {
      this.totalTimeToLastTokenMs = Math.max(0, now - this.scheduledAt);
    }
    if (this.timeToFirstTokenMs !== undefined && this.outputTokens > 0) {
      const streamMs = this.timeToLastTokenMs - this.timeToFirstTokenMs;
      if (streamMs > 0) {
        this.outputTokensPerSec = this.outputTokens / (streamMs / 1000);
      }
    }
  }

  /** Called once per step (inner LLM call) inside `streamText`. */
  onStepFinish(step: StepResult<ToolSet>): void {
    this.totalSteps += 1;

    for (const call of step.toolCalls ?? []) {
      if (call && typeof call.toolName === "string") {
        this.toolSequence.push(call.toolName);
      }
    }

    const usage = step.usage;
    if (usage) {
      this.inputTokens += usage.inputTokens ?? 0;
      this.outputTokens += usage.outputTokens ?? 0;
      const details = (usage as { inputTokenDetails?: Record<string, number | undefined> })
        .inputTokenDetails;
      if (details) {
        this.cacheReadTokens += details.cacheReadTokens ?? 0;
        this.cacheWriteTokens += details.cacheWriteTokens ?? 0;
      }
    }

    // AI SDK v6 moved model info to `step.response.model` for some providers;
    // fall back to `step.model` for providers that still expose it there.
    const responseModel = (step.response as { model?: { provider?: string; modelId?: string } })
      ?.model;
    const stepModel = step.model;
    this.provider = responseModel?.provider ?? stepModel?.provider ?? this.provider;
    this.modelId = responseModel?.modelId ?? stepModel?.modelId ?? this.modelId;

    this.finishReason = normalizeFinishReason(step.finishReason);

    this.extractProductOutcomes(step);
  }

  markRetry(): void {
    this.retryCount += 1;
  }

  markFallback(reason: NonNullable<AiRunRow["fallbackReason"]>): void {
    this.fallbackReason = reason;
  }

  markApprovalPause(): void {
    this.approvalPauses += 1;
  }

  setTerminalErrorClass(cls: string): void {
    this.terminalErrorClass = cls;
  }

  setWorkoutPlanCreated(id: Id<"workoutPlans">): void {
    this.workoutPlanCreatedId = id;
  }

  setWorkoutPushOutcome(outcome: NonNullable<AiRunRow["workoutPushOutcome"]>): void {
    this.workoutPushOutcome = outcome;
  }

  setContextTiming(metrics: ContextTimingMetrics): void {
    this.contextBuildMs = metrics.contextBuildMs;
    this.snapshotBuildMs = metrics.snapshotBuildMs;
    this.contextBuildCount = metrics.contextBuildCount;
    this.contextMessageCount = metrics.contextMessageCount;
    this.snapshotSource = metrics.snapshotSource;
  }

  toRow(): AiRunRow {
    return {
      runId: this.init.runId,
      userId: this.init.userId,
      threadId: this.init.threadId,
      messageId: this.init.messageId,
      source: this.init.source,
      environment: this.init.environment,
      release: this.init.release,
      promptVersion: this.init.promptVersion,
      totalSteps: this.totalSteps,
      toolSequence: [...this.toolSequence],
      retryCount: this.retryCount,
      fallbackReason: this.fallbackReason,
      finishReason: this.finishReason,
      terminalErrorClass: this.terminalErrorClass,
      modelId: this.modelId,
      provider: this.provider,
      inputTokens: this.inputTokens,
      outputTokens: this.outputTokens,
      cacheReadTokens: this.cacheReadTokens,
      cacheWriteTokens: this.cacheWriteTokens,
      // totalCostUsd intentionally left undefined: AI SDK v6 usage doesn't
      // surface per-token USD, and Roni runs on a mix of BYOK and house keys
      // so a single per-model rate would be wrong. Compute downstream from
      // token counts + per-model rates if needed.
      totalCostUsd: undefined,
      scheduledAt: this.scheduledAt,
      processingStartedAt: this.processingStartedAt,
      streamStartedAt: this.startedAt,
      queueDelayMs:
        this.scheduledAt !== undefined && this.processingStartedAt !== undefined
          ? Math.max(0, this.processingStartedAt - this.scheduledAt)
          : undefined,
      preStreamSetupMs:
        this.processingStartedAt !== undefined
          ? Math.max(0, this.startedAt - this.processingStartedAt)
          : undefined,
      timeToFirstTokenMs: this.timeToFirstTokenMs,
      timeToLastTokenMs: this.timeToLastTokenMs,
      totalTimeToFirstTokenMs: this.totalTimeToFirstTokenMs,
      totalTimeToLastTokenMs: this.totalTimeToLastTokenMs,
      outputTokensPerSec: this.outputTokensPerSec,
      contextBuildMs: this.contextBuildMs,
      snapshotBuildMs: this.snapshotBuildMs,
      contextBuildCount: this.contextBuildCount,
      contextMessageCount: this.contextMessageCount,
      snapshotSource: this.snapshotSource,
      retrievalEnabled: this.retrievalEnabled,
      approvalPauses: this.approvalPauses,
      workoutPlanCreatedId: this.workoutPlanCreatedId,
      workoutPushOutcome: this.workoutPushOutcome,
      createdAt: this.startedAt,
    };
  }

  private extractProductOutcomes(step: StepResult<ToolSet>): void {
    for (const result of step.toolResults ?? []) {
      if (!result || typeof result.toolName !== "string") continue;

      if (result.toolName === "create_workout" && isCreateWorkoutOutput(result.output)) {
        if (result.output.success) {
          this.workoutPlanCreatedId = result.output.planId;
          // A successful create_workout leaves a draft needing user approval.
          this.markApprovalPause();
        }
        continue;
      }

      // program_week builds a full 7-day plan that the user must approve
      // before anything pushes to Tonal. Treat each success as a pause.
      if (result.toolName === "program_week" && isSuccessToolOutput(result.output)) {
        this.markApprovalPause();
        continue;
      }

      if (result.toolName === "approve_week_plan" && isApproveWeekPlanOutput(result.output)) {
        const out = result.output;
        if ("error" in out) {
          this.workoutPushOutcome = "failed";
        } else if (out.failed > 0 || out.success === false) {
          this.workoutPushOutcome = "failed";
        } else {
          this.workoutPushOutcome = "pushed";
        }
      }
    }
  }
}

function isSuccessToolOutput(value: unknown): value is { success: true } {
  if (!value || typeof value !== "object") return false;
  return (value as { success?: unknown }).success === true;
}
