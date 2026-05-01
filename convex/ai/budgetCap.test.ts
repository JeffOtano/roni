import { describe, expect, it } from "vitest";
import { budgetCapStopCondition, estimateInteractionCostUsd } from "./budgetCap";

describe("budgetCapStopCondition", () => {
  it("estimates interaction cost from cumulative token usage", () => {
    const cost = estimateInteractionCostUsd(
      [
        {
          usage: {
            inputTokens: 10_000,
            outputTokens: 2_000,
            totalTokens: 12_000,
            inputTokenDetails: {
              noCacheTokens: undefined,
              cacheReadTokens: undefined,
              cacheWriteTokens: undefined,
            },
            outputTokenDetails: {
              textTokens: undefined,
              reasoningTokens: undefined,
            },
          },
        },
        {
          usage: {
            inputTokens: 5_000,
            outputTokens: 3_000,
            totalTokens: 8_000,
            inputTokenDetails: {
              noCacheTokens: undefined,
              cacheReadTokens: undefined,
              cacheWriteTokens: undefined,
            },
            outputTokenDetails: {
              textTokens: undefined,
              reasoningTokens: undefined,
            },
          },
        },
      ],
      {
        maxInteractionUsd: 0.1,
        inputUsdPerMillion: 2.5,
        outputUsdPerMillion: 15,
      },
    );

    expect(cost).toBeCloseTo(0.1125, 6);
  });

  it("fires once the cumulative BYOK cost crosses the provider cap", () => {
    let trip:
      | {
          estimatedCostUsd: number;
          modelId?: string;
          stepCount: number;
        }
      | undefined;
    const stopWhen = budgetCapStopCondition("openai", (value) => {
      trip = value;
    });

    const firstStop = stopWhen({
      steps: [
        {
          usage: { inputTokens: 10_000, outputTokens: 2_000 },
          model: { provider: "openai", modelId: "gpt-5.4" },
          finishReason: "tool-calls",
          toolCalls: [],
          toolResults: [],
          stepNumber: 0,
        } as unknown as Parameters<typeof stopWhen>[0]["steps"][number],
      ],
    });
    const secondStop = stopWhen({
      steps: [
        {
          usage: { inputTokens: 10_000, outputTokens: 2_000 },
          model: { provider: "openai", modelId: "gpt-5.4" },
          finishReason: "tool-calls",
          toolCalls: [],
          toolResults: [],
          stepNumber: 0,
        } as unknown as Parameters<typeof stopWhen>[0]["steps"][number],
        {
          usage: { inputTokens: 5_000, outputTokens: 3_000 },
          model: { provider: "openai", modelId: "gpt-5.4" },
          finishReason: "tool-calls",
          toolCalls: [],
          toolResults: [],
          stepNumber: 1,
        } as unknown as Parameters<typeof stopWhen>[0]["steps"][number],
      ],
    });

    expect(firstStop).toBe(false);
    expect(secondStop).toBe(true);
    expect(trip).toMatchObject({
      modelId: "gpt-5.4",
      stepCount: 2,
    });
    expect(trip?.estimatedCostUsd).toBeCloseTo(0.1125, 6);
  });
});
