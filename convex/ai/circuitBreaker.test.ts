import { describe, expect, it } from "vitest";
import {
  CIRCUIT_BREAKER_OPEN_MS,
  CIRCUIT_BREAKER_WINDOW_MS,
  decideCircuitRoute,
  estimateAttemptCostUsd,
  evaluateBreakerOpenReason,
  resolveHalfOpenProbeResult,
  type StoredCircuitBreakerState,
} from "./circuitBreakerCore";

describe("estimateAttemptCostUsd", () => {
  it("prices GPT-5.4 mini using cached-input discounts", () => {
    expect(
      estimateAttemptCostUsd({
        provider: "openai",
        model: "gpt-5.4-mini",
        inputTokens: 100_000,
        outputTokens: 10_000,
        cacheReadTokens: 20_000,
        cacheWriteTokens: 0,
      }),
    ).toBeCloseTo(0.1065, 4);
  });

  it("normalizes provider-prefixed Gemini model ids", () => {
    expect(
      estimateAttemptCostUsd({
        provider: "openrouter",
        model: "google/gemini-3-flash-preview",
        inputTokens: 200_000,
        outputTokens: 25_000,
        cacheReadTokens: 50_000,
        cacheWriteTokens: 0,
      }),
    ).toBeCloseTo(0.1525, 4);
  });

  it("returns undefined for unknown models", () => {
    expect(
      estimateAttemptCostUsd({
        provider: "openrouter",
        model: "mystery/model",
        inputTokens: 1_000,
        outputTokens: 1_000,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      }),
    ).toBeUndefined();
  });
});

describe("evaluateBreakerOpenReason", () => {
  it("opens on five failures inside the rolling window", () => {
    expect(
      evaluateBreakerOpenReason({
        recentFailures: 5,
        recentFailedCostUsd: 0.25,
      }),
    ).toBe("error_threshold");
  });

  it("opens on failed-cost threshold before the failure-count threshold", () => {
    expect(
      evaluateBreakerOpenReason({
        recentFailures: 2,
        recentFailedCostUsd: 1.01,
      }),
    ).toBe("cost_threshold");
  });

  it("stays closed at the exact failed-cost threshold", () => {
    expect(
      evaluateBreakerOpenReason({
        recentFailures: 2,
        recentFailedCostUsd: 1,
      }),
    ).toBeNull();
  });

  it("stays closed below both thresholds", () => {
    expect(
      evaluateBreakerOpenReason({
        recentFailures: 4,
        recentFailedCostUsd: 0.99,
      }),
    ).toBeNull();
  });
});

describe("decideCircuitRoute", () => {
  it("short-circuits to the fallback path while the breaker is open", () => {
    const state: StoredCircuitBreakerState = {
      provider: "gemini",
      state: "open",
      openUntil: 2_000,
      lastStateChangedAt: 1_000,
    };

    expect(decideCircuitRoute({ state, now: 1_500, runId: "run-1" })).toEqual({
      route: "fallback",
      nextState: null,
      reason: "open_circuit",
    });
  });

  it("claims a single half-open probe when the cooldown expires", () => {
    const state: StoredCircuitBreakerState = {
      provider: "gemini",
      state: "open",
      openUntil: 2_000,
      lastStateChangedAt: 1_000,
    };

    expect(decideCircuitRoute({ state, now: 2_001, runId: "run-2" })).toEqual({
      route: "primary",
      reason: "half_open_probe",
      nextState: {
        provider: "gemini",
        state: "half_open",
        lastStateChangedAt: 2_001,
        openUntil: undefined,
        probeRunId: "run-2",
        probeClaimedAt: 2_001,
        lastOpenReason: undefined,
        lastOpenFailureCount: undefined,
        lastOpenFailedCostUsd: undefined,
      },
    });
  });

  it("keeps later requests on the fallback path while a half-open probe is in flight", () => {
    const state: StoredCircuitBreakerState = {
      provider: "gemini",
      state: "half_open",
      lastStateChangedAt: 2_001,
      probeRunId: "run-2",
      probeClaimedAt: 2_001,
    };

    expect(decideCircuitRoute({ state, now: 2_100, runId: "run-3" })).toEqual({
      route: "fallback",
      nextState: null,
      reason: "half_open_busy",
    });
  });
});

describe("resolveHalfOpenProbeResult", () => {
  it("closes the breaker after a successful half-open probe", () => {
    const state: StoredCircuitBreakerState = {
      provider: "claude",
      state: "half_open",
      lastStateChangedAt: 10,
      probeRunId: "probe-1",
      probeClaimedAt: 10,
      lastOpenReason: "error_threshold",
      lastOpenFailureCount: 5,
      lastOpenFailedCostUsd: 0.5,
    };

    expect(
      resolveHalfOpenProbeResult({
        state,
        now: 20,
        runId: "probe-1",
        outcome: "success",
      }),
    ).toEqual({
      didChange: true,
      eventReason: "probe_success",
      nextState: {
        provider: "claude",
        state: "closed",
        lastStateChangedAt: 20,
        openUntil: undefined,
        probeRunId: undefined,
        probeClaimedAt: undefined,
        lastOpenReason: "error_threshold",
        lastOpenFailureCount: 5,
        lastOpenFailedCostUsd: 0.5,
      },
    });
  });

  it("reopens the breaker after a failed half-open probe", () => {
    const state: StoredCircuitBreakerState = {
      provider: "openai",
      state: "half_open",
      lastStateChangedAt: 10,
      probeRunId: "probe-2",
      probeClaimedAt: 10,
    };

    expect(
      resolveHalfOpenProbeResult({
        state,
        now: 20,
        runId: "probe-2",
        outcome: "failure",
      }),
    ).toEqual({
      didChange: true,
      eventReason: "half_open_failure",
      nextState: {
        provider: "openai",
        state: "open",
        lastStateChangedAt: 20,
        openUntil: 20 + CIRCUIT_BREAKER_OPEN_MS,
        probeRunId: undefined,
        probeClaimedAt: undefined,
        lastOpenReason: "half_open_failure",
        lastOpenFailureCount: undefined,
        lastOpenFailedCostUsd: undefined,
      },
    });
  });
});

describe("circuit breaker constants", () => {
  it("uses a 60 second evaluation window", () => {
    expect(CIRCUIT_BREAKER_WINDOW_MS).toBe(60_000);
  });

  it("opens for five minutes after tripping", () => {
    expect(CIRCUIT_BREAKER_OPEN_MS).toBe(300_000);
  });
});
