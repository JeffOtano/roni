import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalMutation, internalQuery } from "./_generated/server";
import { estimateAttemptCostUsd } from "./ai/circuitBreakerCore";

/** Daily per-user token budget. Configurable - change this constant to adjust. */
export const DAILY_TOKEN_BUDGET = 500_000;

/** 80% threshold for early warning Discord alert. */
export const BUDGET_WARNING_THRESHOLD = 0.8;

/**
 * Validator for one `aiRun` row. Kept in sync with the schema by hand;
 * if a field is added in schema.ts it MUST be added here too, otherwise
 * `recordRun` rejects the insert at runtime.
 */
const aiRunArgs = {
  runId: v.string(),
  userId: v.id("users"),
  threadId: v.string(),
  messageId: v.optional(v.string()),
  source: v.union(v.literal("chat"), v.literal("approval_continuation")),
  environment: v.union(v.literal("dev"), v.literal("prod")),
  release: v.optional(v.string()),
  promptVersion: v.optional(v.string()),
  totalSteps: v.number(),
  toolSequence: v.array(v.string()),
  retryCount: v.number(),
  fallbackReason: v.optional(
    v.union(
      v.literal("transient_exhaustion"),
      v.literal("primary_error"),
      v.literal("circuit_open"),
    ),
  ),
  finishReason: v.optional(
    v.union(
      v.literal("stop"),
      v.literal("tool-calls"),
      v.literal("length"),
      v.literal("content-filter"),
      v.literal("error"),
      v.literal("other"),
      v.literal("unknown"),
    ),
  ),
  terminalErrorClass: v.optional(v.string()),
  modelId: v.optional(v.string()),
  provider: v.optional(v.string()),
  inputTokens: v.number(),
  outputTokens: v.number(),
  cacheReadTokens: v.number(),
  cacheWriteTokens: v.number(),
  totalCostUsd: v.optional(v.number()),
  scheduledAt: v.optional(v.number()),
  processingStartedAt: v.optional(v.number()),
  streamStartedAt: v.optional(v.number()),
  queueDelayMs: v.optional(v.number()),
  preStreamSetupMs: v.optional(v.number()),
  timeToFirstTokenMs: v.optional(v.number()),
  timeToLastTokenMs: v.optional(v.number()),
  totalTimeToFirstTokenMs: v.optional(v.number()),
  totalTimeToLastTokenMs: v.optional(v.number()),
  outputTokensPerSec: v.optional(v.number()),
  contextBuildMs: v.optional(v.number()),
  snapshotBuildMs: v.optional(v.number()),
  contextBuildCount: v.optional(v.number()),
  contextMessageCount: v.optional(v.number()),
  snapshotSource: v.optional(v.literal("live_rebuild")),
  retrievalEnabled: v.optional(v.boolean()),
  approvalPauses: v.number(),
  workoutPlanCreatedId: v.optional(v.id("workoutPlans")),
  workoutPushOutcome: v.optional(
    v.union(v.literal("pushed"), v.literal("failed"), v.literal("none")),
  ),
  pushDivergence: v.optional(
    v.object({
      missingMovements: v.array(v.string()),
      extraMovements: v.array(v.string()),
      setCountMismatches: v.array(
        v.object({
          movementId: v.string(),
          intended: v.number(),
          stored: v.number(),
        }),
      ),
    }),
  ),
  createdAt: v.number(),
};

export const record = internalMutation({
  args: {
    userId: v.optional(v.id("users")),
    threadId: v.optional(v.string()),
    agentName: v.optional(v.string()),
    model: v.string(),
    provider: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    totalTokens: v.number(),
    cacheReadTokens: v.optional(v.number()),
    cacheWriteTokens: v.optional(v.number()),
    stoppedByBudget: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("aiUsage", {
      ...args,
      totalCostUsd:
        estimateAttemptCostUsd({
          provider: args.provider,
          model: args.model,
          inputTokens: args.inputTokens,
          outputTokens: args.outputTokens,
          cacheReadTokens: args.cacheReadTokens ?? 0,
          cacheWriteTokens: args.cacheWriteTokens ?? 0,
        }) ?? undefined,
      createdAt: Date.now(),
    });
  },
});

const DEFAULT_CACHE_RATE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export interface CacheHitRateRow {
  provider: string;
  rows: number;
  inputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  cacheReadRatio: number;
}

export interface AiUsageTokenRow {
  provider: string;
  inputTokens: number;
  outputTokens?: number;
  totalTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
}

interface UsageCostMultipliers {
  cacheRead: number;
  cacheWrite: number;
  output: number;
}

const DEFAULT_USAGE_COST_MULTIPLIERS: UsageCostMultipliers = {
  cacheRead: 1,
  cacheWrite: 1,
  output: 1,
};

const USAGE_COST_MULTIPLIERS_BY_PROVIDER: Partial<Record<string, UsageCostMultipliers>> = {
  claude: {
    cacheRead: 0.1,
    cacheWrite: 1.25,
    output: 5,
  },
};

function getUsageCostMultipliers(provider?: string) {
  if (!provider) return DEFAULT_USAGE_COST_MULTIPLIERS;
  return USAGE_COST_MULTIPLIERS_BY_PROVIDER[provider] ?? DEFAULT_USAGE_COST_MULTIPLIERS;
}

export function calculateWeightedUsageTokens(row: AiUsageTokenRow): number {
  const cacheReadTokens = row.cacheReadTokens ?? 0;
  const cacheWriteTokens = row.cacheWriteTokens ?? 0;
  const outputTokens = row.outputTokens ?? 0;

  if (row.cacheReadTokens === undefined && row.cacheWriteTokens === undefined) {
    return row.totalTokens ?? row.inputTokens + outputTokens;
  }

  const freshInputTokens = Math.max(0, row.inputTokens - cacheReadTokens - cacheWriteTokens);
  const multipliers = getUsageCostMultipliers(row.provider);
  return (
    freshInputTokens +
    cacheWriteTokens * multipliers.cacheWrite +
    cacheReadTokens * multipliers.cacheRead +
    outputTokens * multipliers.output
  );
}

export function aggregateCacheHitsByProvider(rows: AiUsageTokenRow[]): CacheHitRateRow[] {
  const byProvider = new Map<
    string,
    { rows: number; inputTokens: number; cacheReadTokens: number; cacheWriteTokens: number }
  >();
  for (const row of rows) {
    // Routing rows (`provider: "local"`) have no model call, skip them.
    if (row.inputTokens === 0) continue;
    const agg = byProvider.get(row.provider) ?? {
      rows: 0,
      inputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    };
    agg.rows += 1;
    agg.inputTokens += row.inputTokens;
    agg.cacheReadTokens += row.cacheReadTokens ?? 0;
    agg.cacheWriteTokens += row.cacheWriteTokens ?? 0;
    byProvider.set(row.provider, agg);
  }

  return Array.from(byProvider.entries())
    .map(([provider, agg]) => ({
      provider,
      ...agg,
      cacheReadRatio: agg.inputTokens === 0 ? 0 : agg.cacheReadTokens / agg.inputTokens,
    }))
    .sort((a, b) => b.inputTokens - a.inputTokens);
}

/**
 * Aggregate cache-read ratio grouped by provider over a recent window.
 * Run ad-hoc (e.g. `npx convex run aiUsage:getCacheHitRateByProvider --prod`)
 * to decide whether explicit provider caching is worth pursuing.
 */
export const getCacheHitRateByProvider = internalQuery({
  args: { windowMs: v.optional(v.number()) },
  handler: async (ctx, { windowMs = DEFAULT_CACHE_RATE_WINDOW_MS }) => {
    const since = Date.now() - windowMs;
    const rows = await ctx.db
      .query("aiUsage")
      .withIndex("by_createdAt", (q) => q.gte("createdAt", since))
      .collect();
    return aggregateCacheHitsByProvider(rows);
  },
});

export const recordRouting = internalMutation({
  args: {
    userId: v.string(),
    threadId: v.string(),
    intent: v.string(),
    agentName: v.string(),
  },
  handler: async (ctx, { userId, threadId, intent, agentName }) => {
    await ctx.db.insert("aiUsage", {
      userId: userId as Id<"users">,
      threadId,
      agentName,
      model: "keyword-classifier",
      provider: "local",
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      routedIntent: intent,
      createdAt: Date.now(),
    });
  },
});

export const recordBudgetStop = internalMutation({
  args: {
    userId: v.id("users"),
    threadId: v.string(),
    provider: v.string(),
    model: v.string(),
  },
  handler: async (ctx, { userId, threadId, provider, model }) => {
    await ctx.db.insert("aiUsage", {
      userId,
      threadId,
      agentName: "budget-cap",
      model,
      provider,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      stoppedByBudget: true,
      createdAt: Date.now(),
    });
  },
});

/** Persist a single per-turn telemetry row built by `RunAccumulator`. */
export const recordRun = internalMutation({
  args: aiRunArgs,
  handler: async (ctx, args) => {
    await ctx.db.insert("aiRun", args);
  },
});

export const recordToolCall = internalMutation({
  args: {
    userId: v.optional(v.string()),
    threadId: v.optional(v.string()),
    toolName: v.string(),
    durationMs: v.number(),
    success: v.boolean(),
    error: v.optional(v.string()),
    runId: v.optional(v.string()),
    toolCallId: v.optional(v.string()),
    argsJson: v.optional(v.string()),
    resultPreview: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("aiToolCalls", { ...args, createdAt: Date.now() });
  },
});

export const claimDailyBudgetWarning = internalMutation({
  args: { userId: v.id("users"), date: v.string() },
  handler: async (ctx, { userId, date }) => {
    const existing = await ctx.db
      .query("aiBudgetWarnings")
      .withIndex("by_userId_date", (q) => q.eq("userId", userId).eq("date", date))
      .unique();
    if (existing) return false;
    await ctx.db.insert("aiBudgetWarnings", { userId, date, createdAt: Date.now() });
    return true;
  },
});

/** Get weighted budget tokens used by a user today (UTC day boundary). */
export const getDailyTokenUsage = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const now = Date.now();
    const startOfDay = new Date(now);
    startOfDay.setUTCHours(0, 0, 0, 0);

    const records = await ctx.db
      .query("aiUsage")
      .withIndex("by_userId_createdAt", (q) =>
        q.eq("userId", userId).gte("createdAt", startOfDay.getTime()),
      )
      .collect();

    return records.reduce((sum, record) => sum + calculateWeightedUsageTokens(record), 0);
  },
});

export const getDailyTokenUsageStats = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const now = Date.now();
    const startOfDay = new Date(now);
    startOfDay.setUTCHours(0, 0, 0, 0);

    const records = await ctx.db
      .query("aiUsage")
      .withIndex("by_userId_createdAt", (q) =>
        q.eq("userId", userId).gte("createdAt", startOfDay.getTime()),
      )
      .collect();

    let latestCreatedAt = 0;
    let latestUsageTokens = 0;
    let totalTokens = 0;
    for (const record of records) {
      const weightedTokens = calculateWeightedUsageTokens(record);
      totalTokens += weightedTokens;
      if (weightedTokens > 0 && record.createdAt >= latestCreatedAt) {
        latestCreatedAt = record.createdAt;
        latestUsageTokens = weightedTokens;
      }
    }

    return { totalTokens, latestUsageTokens };
  },
});
