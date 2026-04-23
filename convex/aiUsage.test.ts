import { describe, expect, it } from "vitest";
import {
  aggregateCacheHitsByProvider,
  BUDGET_WARNING_THRESHOLD,
  DAILY_TOKEN_BUDGET,
} from "./aiUsage";

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

describe("aggregateCacheHitsByProvider", () => {
  it("groups rows by provider and computes cache read ratio", () => {
    const result = aggregateCacheHitsByProvider([
      { provider: "gemini", inputTokens: 10_000, cacheReadTokens: 8_000, cacheWriteTokens: 0 },
      { provider: "gemini", inputTokens: 5_000, cacheReadTokens: 1_000, cacheWriteTokens: 0 },
      { provider: "claude", inputTokens: 8_000, cacheReadTokens: 6_000, cacheWriteTokens: 500 },
    ]);

    const gemini = result.find((r) => r.provider === "gemini");
    expect(gemini).toMatchObject({ rows: 2, inputTokens: 15_000, cacheReadTokens: 9_000 });
    expect(gemini!.cacheReadRatio).toBeCloseTo(9_000 / 15_000);

    const claude = result.find((r) => r.provider === "claude");
    expect(claude).toMatchObject({
      rows: 1,
      inputTokens: 8_000,
      cacheReadTokens: 6_000,
      cacheWriteTokens: 500,
    });
  });

  it("skips rows with zero input tokens (routing entries)", () => {
    const result = aggregateCacheHitsByProvider([
      { provider: "local", inputTokens: 0 },
      { provider: "gemini", inputTokens: 1_000, cacheReadTokens: 500 },
    ]);

    expect(result.map((r) => r.provider)).toEqual(["gemini"]);
  });

  it("returns providers sorted by input token volume descending", () => {
    const result = aggregateCacheHitsByProvider([
      { provider: "openai", inputTokens: 1_000 },
      { provider: "gemini", inputTokens: 100_000 },
      { provider: "claude", inputTokens: 20_000 },
    ]);

    expect(result.map((r) => r.provider)).toEqual(["gemini", "claude", "openai"]);
  });

  it("defaults missing cache fields to zero without NaN ratios", () => {
    const result = aggregateCacheHitsByProvider([{ provider: "openai", inputTokens: 2_000 }]);

    expect(result[0]).toMatchObject({
      provider: "openai",
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      cacheReadRatio: 0,
    });
  });
});
