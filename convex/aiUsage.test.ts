import { describe, expect, it } from "vitest";
import { BUDGET_WARNING_THRESHOLD, DAILY_TOKEN_BUDGET } from "./aiUsage";

describe("AI usage constants", () => {
  it("DAILY_TOKEN_BUDGET is 500k", () => {
    expect(DAILY_TOKEN_BUDGET).toBe(500_000);
  });

  it("BUDGET_WARNING_THRESHOLD is 80%", () => {
    expect(BUDGET_WARNING_THRESHOLD).toBe(0.8);
  });

  it("warning threshold is less than budget", () => {
    expect(DAILY_TOKEN_BUDGET * BUDGET_WARNING_THRESHOLD).toBeLessThan(DAILY_TOKEN_BUDGET);
  });
});
