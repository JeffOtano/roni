import { describe, expect, it } from "vitest";
import { calculateWeightedUsageTokens } from "../aiUsage";
import { BUDGET_WARNING_THRESHOLD, DAILY_TOKEN_BUDGET } from "../aiUsage";
import { shouldNotifyBudgetWarning } from "./budget";

const WARNING_THRESHOLD_TOKENS = DAILY_TOKEN_BUDGET * BUDGET_WARNING_THRESHOLD;

describe("shouldNotifyBudgetWarning", () => {
  it("notifies only when the latest usage record crossed the warning threshold", () => {
    expect(shouldNotifyBudgetWarning(WARNING_THRESHOLD_TOKENS - 1, 1000)).toBe(false);
    expect(shouldNotifyBudgetWarning(WARNING_THRESHOLD_TOKENS + 1, 1000)).toBe(true);
  });

  it("does not notify when the user was already above the threshold before the latest usage", () => {
    expect(shouldNotifyBudgetWarning(WARNING_THRESHOLD_TOKENS + 1000, 100)).toBe(false);
  });

  it("reaches the warning threshold later for cache-read-heavy Claude usage than fresh usage", () => {
    const freshUsage = calculateWeightedUsageTokens({
      provider: "claude",
      inputTokens: WARNING_THRESHOLD_TOKENS + 1,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    });
    const cachedUsage = calculateWeightedUsageTokens({
      provider: "claude",
      inputTokens: WARNING_THRESHOLD_TOKENS + 1,
      outputTokens: 0,
      cacheReadTokens: WARNING_THRESHOLD_TOKENS + 1,
      cacheWriteTokens: 0,
    });

    expect(shouldNotifyBudgetWarning(freshUsage, freshUsage)).toBe(true);
    expect(cachedUsage).toBeLessThan(WARNING_THRESHOLD_TOKENS);
    expect(shouldNotifyBudgetWarning(cachedUsage, cachedUsage)).toBe(false);
  });
});
