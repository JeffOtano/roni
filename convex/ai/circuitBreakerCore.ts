import type { ProviderId } from "./providers";

export const CIRCUIT_BREAKER_WINDOW_MS = 60_000;
export const CIRCUIT_BREAKER_OPEN_MS = 5 * 60_000;
const CIRCUIT_BREAKER_FAILURE_THRESHOLD = 5;
const CIRCUIT_BREAKER_FAILED_COST_THRESHOLD_USD = 1;

export type CircuitBreakerState = "closed" | "open" | "half_open";
export type BreakerOpenReason = "error_threshold" | "cost_threshold" | "half_open_failure";
export type BreakerRouteReason = "closed" | "open_circuit" | "half_open_probe" | "half_open_busy";

export interface StoredCircuitBreakerState {
  provider: ProviderId;
  state: CircuitBreakerState;
  openUntil?: number;
  probeRunId?: string;
  probeClaimedAt?: number;
  lastStateChangedAt: number;
  lastOpenReason?: BreakerOpenReason;
  lastOpenFailureCount?: number;
  lastOpenFailedCostUsd?: number;
}

interface ModelRate {
  inputUsdPerMillion: number;
  cacheReadUsdPerMillion: number;
  cacheWriteUsdPerMillion: number;
  outputUsdPerMillion: number;
}

const MODEL_RATES: ReadonlyArray<{
  matches: readonly string[];
  rate: ModelRate;
}> = [
  {
    matches: ["gpt-5.4-mini"],
    rate: {
      inputUsdPerMillion: 0.75,
      cacheReadUsdPerMillion: 0.075,
      cacheWriteUsdPerMillion: 0.75,
      outputUsdPerMillion: 4.5,
    },
  },
  {
    matches: ["gpt-5.4"],
    rate: {
      inputUsdPerMillion: 2.5,
      cacheReadUsdPerMillion: 0.25,
      cacheWriteUsdPerMillion: 2.5,
      outputUsdPerMillion: 15,
    },
  },
  {
    matches: ["claude-haiku-4.5", "claude-haiku-4-5"],
    rate: {
      inputUsdPerMillion: 1,
      cacheReadUsdPerMillion: 0.1,
      cacheWriteUsdPerMillion: 1.25,
      outputUsdPerMillion: 5,
    },
  },
  {
    matches: ["claude-sonnet-4.6", "claude-sonnet-4-6"],
    rate: {
      inputUsdPerMillion: 3,
      cacheReadUsdPerMillion: 0.3,
      cacheWriteUsdPerMillion: 3.75,
      outputUsdPerMillion: 15,
    },
  },
  {
    matches: ["gemini-3-flash-preview"],
    rate: {
      inputUsdPerMillion: 0.5,
      cacheReadUsdPerMillion: 0.05,
      cacheWriteUsdPerMillion: 0.05,
      outputUsdPerMillion: 3,
    },
  },
  {
    matches: ["gemini-2.5-flash-lite", "gemini-2.5-flash-lite-preview"],
    rate: {
      inputUsdPerMillion: 0.1,
      cacheReadUsdPerMillion: 0.01,
      cacheWriteUsdPerMillion: 0.01,
      outputUsdPerMillion: 0.4,
    },
  },
  {
    matches: ["gemini-2.5-flash"],
    rate: {
      inputUsdPerMillion: 0.3,
      cacheReadUsdPerMillion: 0.03,
      cacheWriteUsdPerMillion: 0.03,
      outputUsdPerMillion: 2.5,
    },
  },
] as const;

export interface AttemptCostInput {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export interface BreakerWindowMetrics {
  recentFailures: number;
  recentFailedCostUsd: number;
}

export interface CircuitRouteDecision {
  route: "primary" | "fallback";
  reason: BreakerRouteReason;
  nextState: StoredCircuitBreakerState | null;
}

export interface HalfOpenProbeResolution {
  didChange: boolean;
  eventReason: "probe_success" | "half_open_failure" | null;
  nextState: StoredCircuitBreakerState;
}

export function estimateAttemptCostUsd(input: AttemptCostInput): number | undefined {
  const rate = getModelRate(input.model);
  if (!rate) return undefined;

  const cacheReadTokens = Math.max(0, input.cacheReadTokens);
  const cacheWriteTokens = Math.max(0, input.cacheWriteTokens);
  const freshInputTokens = Math.max(0, input.inputTokens - cacheReadTokens - cacheWriteTokens);

  return (
    (freshInputTokens * rate.inputUsdPerMillion +
      cacheReadTokens * rate.cacheReadUsdPerMillion +
      cacheWriteTokens * rate.cacheWriteUsdPerMillion +
      Math.max(0, input.outputTokens) * rate.outputUsdPerMillion) /
    1_000_000
  );
}

export function evaluateBreakerOpenReason(metrics: BreakerWindowMetrics): BreakerOpenReason | null {
  if (metrics.recentFailures >= CIRCUIT_BREAKER_FAILURE_THRESHOLD) {
    return "error_threshold";
  }
  if (metrics.recentFailedCostUsd > CIRCUIT_BREAKER_FAILED_COST_THRESHOLD_USD) {
    return "cost_threshold";
  }
  return null;
}

export function decideCircuitRoute(args: {
  state?: StoredCircuitBreakerState;
  now: number;
  runId: string;
}): CircuitRouteDecision {
  const { state, now, runId } = args;
  if (!state || state.state === "closed") {
    return { route: "primary", reason: "closed", nextState: null };
  }

  if (state.state === "open") {
    if (state.openUntil !== undefined && state.openUntil > now) {
      return { route: "fallback", reason: "open_circuit", nextState: null };
    }

    return {
      route: "primary",
      reason: "half_open_probe",
      nextState: {
        ...state,
        state: "half_open",
        openUntil: undefined,
        probeRunId: runId,
        probeClaimedAt: now,
        lastStateChangedAt: now,
      },
    };
  }

  if (state.probeRunId && state.probeRunId !== runId) {
    return { route: "fallback", reason: "half_open_busy", nextState: null };
  }

  if (state.probeRunId === runId) {
    return { route: "primary", reason: "half_open_probe", nextState: null };
  }

  return {
    route: "primary",
    reason: "half_open_probe",
    nextState: {
      ...state,
      probeRunId: runId,
      probeClaimedAt: now,
      lastStateChangedAt: now,
    },
  };
}

export function resolveHalfOpenProbeResult(args: {
  state: StoredCircuitBreakerState;
  now: number;
  runId: string;
  outcome: "success" | "failure";
}): HalfOpenProbeResolution {
  const { state, now, runId, outcome } = args;
  if (state.state !== "half_open" || state.probeRunId !== runId) {
    return { didChange: false, eventReason: null, nextState: state };
  }

  if (outcome === "success") {
    return {
      didChange: true,
      eventReason: "probe_success",
      nextState: {
        ...state,
        state: "closed",
        openUntil: undefined,
        probeRunId: undefined,
        probeClaimedAt: undefined,
        lastStateChangedAt: now,
      },
    };
  }

  return {
    didChange: true,
    eventReason: "half_open_failure",
    nextState: {
      ...state,
      state: "open",
      openUntil: now + CIRCUIT_BREAKER_OPEN_MS,
      probeRunId: undefined,
      probeClaimedAt: undefined,
      lastStateChangedAt: now,
      lastOpenReason: "half_open_failure",
    },
  };
}

function getModelRate(model: string): ModelRate | undefined {
  const normalizedModel = normalizeModel(model);
  const match = MODEL_RATES.find(({ matches }) =>
    matches.some((candidate) => normalizedModel.startsWith(candidate)),
  );
  return match?.rate;
}

function normalizeModel(model: string): string {
  return model.trim().toLowerCase().split("/").pop() ?? model.trim().toLowerCase();
}
