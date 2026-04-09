import { describe, expect, it } from "vitest";
import { formatHealthSummary, type HealthSignals } from "./healthCheck";

describe("formatHealthSummary", () => {
  it("returns all-clear when no issues", () => {
    const signals: HealthSignals = {
      expiredTokenCount: 0,
      stuckPushCount: 0,
      circuitOpen: false,
    };
    const result = formatHealthSummary(signals);
    expect(result).toContain("All clear");
    expect(result).not.toContain("ALERT");
  });

  it("flags expired tokens above threshold", () => {
    const signals: HealthSignals = {
      expiredTokenCount: 3,
      stuckPushCount: 0,
      circuitOpen: false,
    };
    const result = formatHealthSummary(signals);
    expect(result).toContain("3 expired tokens");
  });

  it("does not flag expired tokens below threshold", () => {
    const signals: HealthSignals = {
      expiredTokenCount: 1,
      stuckPushCount: 0,
      circuitOpen: false,
    };
    const result = formatHealthSummary(signals);
    expect(result).toContain("All clear");
  });

  it("flags stuck pushes", () => {
    const signals: HealthSignals = {
      expiredTokenCount: 0,
      stuckPushCount: 2,
      circuitOpen: false,
    };
    const result = formatHealthSummary(signals);
    expect(result).toContain("2 stuck");
  });

  it("combines multiple issues with pipe separator", () => {
    const signals: HealthSignals = {
      expiredTokenCount: 5,
      stuckPushCount: 1,
      circuitOpen: false,
    };
    const result = formatHealthSummary(signals);
    expect(result).toContain("5 expired tokens");
    expect(result).toContain("1 stuck");
    expect(result).toContain(" | ");
  });

  it("flags open circuit breaker", () => {
    const signals: HealthSignals = {
      expiredTokenCount: 0,
      stuckPushCount: 0,
      circuitOpen: true,
    };
    const result = formatHealthSummary(signals);
    expect(result).toContain("circuit breaker OPEN");
  });

  it("does not flag closed circuit breaker", () => {
    const signals: HealthSignals = {
      expiredTokenCount: 0,
      stuckPushCount: 0,
      circuitOpen: false,
    };
    const result = formatHealthSummary(signals);
    expect(result).toContain("All clear");
    expect(result).not.toContain("circuit breaker");
  });
});
