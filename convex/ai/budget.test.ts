import { describe, expect, it } from "vitest";
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
});
