import { v } from "convex/values";
import { internalMutation, type MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import type { ProviderId } from "./providers";
import {
  type BreakerOpenReason,
  CIRCUIT_BREAKER_OPEN_MS,
  CIRCUIT_BREAKER_WINDOW_MS,
  type CircuitBreakerState,
  decideCircuitRoute,
  evaluateBreakerOpenReason,
  resolveHalfOpenProbeResult,
  type StoredCircuitBreakerState,
} from "./circuitBreakerCore";

const PROVIDER_VALIDATOR = v.union(
  v.literal("gemini"),
  v.literal("claude"),
  v.literal("openai"),
  v.literal("openrouter"),
);

async function insertBreakerEvent(
  ctx: MutationCtx,
  args: {
    provider: ProviderId;
    model: string;
    userId?: Id<"users">;
    threadId?: string;
    runId: string;
    now: number;
    totalCostUsd?: number;
    event: {
      type: "attempt_failed" | "opened" | "closed" | "short_circuited";
      state: CircuitBreakerState;
      reason?: BreakerOpenReason | "open_circuit" | "half_open_busy" | "probe_success";
      recentFailures?: number;
      recentFailedCostUsd?: number;
      openUntil?: number;
      errorClass?: string;
    };
  },
): Promise<void> {
  await ctx.db.insert("aiUsage", {
    userId: args.userId,
    threadId: args.threadId,
    agentName: "circuit-breaker",
    model: args.model,
    provider: args.provider,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    totalCostUsd: args.totalCostUsd,
    breakerEvent: {
      ...args.event,
      runId: args.runId,
    },
    createdAt: args.now,
  });
}

async function getStoredState(
  ctx: MutationCtx,
  provider: ProviderId,
): Promise<
  | {
      id: Id<"aiProviderCircuitBreakers">;
      state: StoredCircuitBreakerState;
    }
  | undefined
> {
  const row = await ctx.db
    .query("aiProviderCircuitBreakers")
    .withIndex("by_provider", (q) => q.eq("provider", provider))
    .unique();
  if (!row) return undefined;
  return {
    id: row._id,
    state: {
      provider: row.provider,
      state: row.state,
      openUntil: row.openUntil,
      probeRunId: row.probeRunId,
      probeClaimedAt: row.probeClaimedAt,
      lastStateChangedAt: row.lastStateChangedAt,
      lastOpenReason: row.lastOpenReason,
      lastOpenFailureCount: row.lastOpenFailureCount,
      lastOpenFailedCostUsd: row.lastOpenFailedCostUsd,
    },
  };
}

async function persistState(
  ctx: MutationCtx,
  existingId: Id<"aiProviderCircuitBreakers"> | undefined,
  state: StoredCircuitBreakerState,
): Promise<void> {
  if (existingId) {
    await ctx.db.patch(existingId, state);
    return;
  }
  await ctx.db.insert("aiProviderCircuitBreakers", state);
}

export const reservePrimaryAttempt = internalMutation({
  args: {
    provider: PROVIDER_VALIDATOR,
    runId: v.string(),
    userId: v.optional(v.id("users")),
    threadId: v.optional(v.string()),
  },
  handler: async (ctx, { provider, runId, userId, threadId }) => {
    const now = Date.now();
    const existing = await getStoredState(ctx, provider);
    const decision = decideCircuitRoute({ state: existing?.state, now, runId });

    if (!existing) {
      await persistState(ctx, undefined, {
        provider,
        state: decision.nextState?.state ?? "closed",
        openUntil: decision.nextState?.openUntil,
        probeRunId: decision.nextState?.probeRunId,
        probeClaimedAt: decision.nextState?.probeClaimedAt,
        lastStateChangedAt: decision.nextState?.lastStateChangedAt ?? now,
        lastOpenReason: decision.nextState?.lastOpenReason,
        lastOpenFailureCount: decision.nextState?.lastOpenFailureCount,
        lastOpenFailedCostUsd: decision.nextState?.lastOpenFailedCostUsd,
      });
    } else if (decision.nextState) {
      await persistState(ctx, existing.id, decision.nextState);
    }

    if (decision.route === "fallback") {
      await insertBreakerEvent(ctx, {
        provider,
        model: "circuit-breaker",
        userId,
        threadId,
        runId,
        now,
        event: {
          type: "short_circuited",
          state: existing?.state.state ?? "open",
          reason: decision.reason === "half_open_busy" ? "half_open_busy" : "open_circuit",
        },
      });
    }

    return decision;
  },
});

export const recordPrimaryAttemptFailure = internalMutation({
  args: {
    provider: PROVIDER_VALIDATOR,
    runId: v.string(),
    userId: v.optional(v.id("users")),
    threadId: v.optional(v.string()),
    model: v.string(),
    totalCostUsd: v.optional(v.number()),
    errorClass: v.string(),
  },
  handler: async (ctx, { provider, runId, userId, threadId, model, totalCostUsd, errorClass }) => {
    const now = Date.now();
    const existing = await getStoredState(ctx, provider);
    const currentState =
      existing?.state ??
      ({
        provider,
        state: "closed",
        lastStateChangedAt: now,
      } satisfies StoredCircuitBreakerState);

    await insertBreakerEvent(ctx, {
      provider,
      model,
      userId,
      threadId,
      runId,
      now,
      totalCostUsd,
      event: {
        type: "attempt_failed",
        state: currentState.state,
        errorClass,
      },
    });

    if (currentState.state === "half_open" && currentState.probeRunId === runId) {
      const resolution = resolveHalfOpenProbeResult({
        state: currentState,
        now,
        runId,
        outcome: "failure",
      });
      await persistState(ctx, existing?.id, resolution.nextState);
      await insertBreakerEvent(ctx, {
        provider,
        model,
        userId,
        threadId,
        runId,
        now,
        totalCostUsd,
        event: {
          type: "opened",
          state: "open",
          reason: "half_open_failure",
          openUntil: resolution.nextState.openUntil,
        },
      });
      return {
        opened: true,
        openReason: "half_open_failure" as const,
        recentFailures: 1,
        recentFailedCostUsd: totalCostUsd ?? 0,
        openUntil: resolution.nextState.openUntil,
      };
    }

    const recentRows = await ctx.db
      .query("aiUsage")
      .withIndex("by_provider_createdAt", (q) =>
        q.eq("provider", provider).gte("createdAt", now - CIRCUIT_BREAKER_WINDOW_MS),
      )
      .collect();

    const failureRows = recentRows.filter((row) => row.breakerEvent?.type === "attempt_failed");
    const recentFailures = failureRows.length;
    const recentFailedCostUsd = failureRows.reduce((sum, row) => sum + (row.totalCostUsd ?? 0), 0);
    const openReason = evaluateBreakerOpenReason({ recentFailures, recentFailedCostUsd });
    if (!openReason) {
      return {
        opened: false,
        openReason: null,
        recentFailures,
        recentFailedCostUsd,
      };
    }

    const nextState: StoredCircuitBreakerState = {
      provider,
      state: "open",
      openUntil: now + CIRCUIT_BREAKER_OPEN_MS,
      probeRunId: undefined,
      probeClaimedAt: undefined,
      lastStateChangedAt: now,
      lastOpenReason: openReason,
      lastOpenFailureCount: recentFailures,
      lastOpenFailedCostUsd: recentFailedCostUsd,
    };
    await persistState(ctx, existing?.id, nextState);
    await insertBreakerEvent(ctx, {
      provider,
      model,
      userId,
      threadId,
      runId,
      now,
      totalCostUsd,
      event: {
        type: "opened",
        state: "open",
        reason: openReason,
        recentFailures,
        recentFailedCostUsd,
        openUntil: nextState.openUntil,
      },
    });

    return {
      opened: true,
      openReason,
      recentFailures,
      recentFailedCostUsd,
      openUntil: nextState.openUntil,
    };
  },
});

export const recordPrimaryAttemptSuccess = internalMutation({
  args: {
    provider: PROVIDER_VALIDATOR,
    runId: v.string(),
    userId: v.optional(v.id("users")),
    threadId: v.optional(v.string()),
    model: v.string(),
  },
  handler: async (ctx, { provider, runId, userId, threadId, model }) => {
    const now = Date.now();
    const existing = await getStoredState(ctx, provider);
    if (!existing) return { closed: false };

    const resolution = resolveHalfOpenProbeResult({
      state: existing.state,
      now,
      runId,
      outcome: "success",
    });
    if (!resolution.didChange) return { closed: false };

    await persistState(ctx, existing.id, resolution.nextState);
    await insertBreakerEvent(ctx, {
      provider,
      model,
      userId,
      threadId,
      runId,
      now,
      event: {
        type: "closed",
        state: "closed",
        reason: "probe_success",
      },
    });
    return { closed: true };
  },
});
