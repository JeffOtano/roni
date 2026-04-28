import { describe, expect, it } from "vitest";
import { formatHealthSummary, type HealthSignals } from "./healthCheck";

describe("formatHealthSummary", () => {
  it("returns all-clear when no issues", () => {
    const signals: HealthSignals = {
      expiredTokenCount: 0,
    };
    const result = formatHealthSummary(signals);
    expect(result).toContain("All clear");
    expect(result).not.toContain("ALERT");
  });

  it("flags expired tokens above threshold", () => {
    const signals: HealthSignals = {
      expiredTokenCount: 3,
    };
    const result = formatHealthSummary(signals);
    expect(result).toContain("3 expired tokens");
  });

  it("does not flag expired tokens below threshold", () => {
    const signals: HealthSignals = {
      expiredTokenCount: 1,
    };
    const result = formatHealthSummary(signals);
    expect(result).toContain("All clear");
  });
});
