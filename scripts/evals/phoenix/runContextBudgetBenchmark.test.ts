import { describe, expect, it } from "vitest";
import type { EvalScenario } from "../../../convex/ai/evalScenarios";
import {
  buildBenchmarkSystem,
  estimateBenchmarkPromptTokens,
  runBenchmarkScenario,
  summarizeModeResults,
} from "./runContextBudgetBenchmark";

const scenario = {
  name: "Bench follow-up",
  capability: "weekly_programming",
  description: "User asks about a recent bench preference.",
  snapshot: "Strength score: Chest 420",
  userMessage: "Keep bench in the plan.",
  rubric: { mustContain: ["bench"] },
} satisfies EvalScenario;

describe("context budget benchmark helpers", () => {
  it("builds the expected systems for each benchmark mode", () => {
    expect(buildBenchmarkSystem("INSTRUCTIONS", scenario, "recent-only")).toBe("INSTRUCTIONS");

    const snapshotOnly = buildBenchmarkSystem("INSTRUCTIONS", scenario, "snapshot-only");
    expect(snapshotOnly).toContain("<training-data>\nStrength score: Chest 420\n</training-data>");
    expect(snapshotOnly).not.toContain("<retrieved-context>");

    const ragFallback = buildBenchmarkSystem("INSTRUCTIONS", scenario, "rag-fallback");
    expect(ragFallback).toContain("<retrieved-context>");
    expect(ragFallback).toContain("User asks about a recent bench preference.");
    expect(ragFallback).toContain("<training-data>\nStrength score: Chest 420\n</training-data>");
  });

  it("estimates prompt tokens from both system and user prompt text", () => {
    expect(estimateBenchmarkPromptTokens("abcd", "abcd")).toBe(2);
  });

  it("returns a failed result when generation throws", async () => {
    const result = await runBenchmarkScenario("INSTRUCTIONS", scenario, "recent-only", async () => {
      throw new Error("quota exhausted");
    });

    expect(result).toMatchObject({
      mode: "recent-only",
      scenarioName: "Bench follow-up",
      passed: false,
      notes: ["generateText threw: quota exhausted"],
    });
    expect(result.estimatedPromptTokens).toBeGreaterThan(0);
  });

  it("checks generated text with the shared rubric helpers", async () => {
    const result = await runBenchmarkScenario(
      "INSTRUCTIONS",
      scenario,
      "recent-only",
      async () => ({
        text: "bench stays in the plan",
        toolCalls: [{ toolName: "program_week" }],
        usage: { inputTokens: 123 },
      }),
    );

    expect(result).toMatchObject({
      passed: true,
      actualInputTokens: 123,
    });
  });

  it("summarizes modes while ignoring missing actual provider token counts", () => {
    const summary = summarizeModeResults(
      [
        {
          mode: "recent-only",
          scenarioName: "one",
          passed: true,
          notes: [],
          estimatedPromptTokens: 10,
          actualInputTokens: 20,
          latencyMs: 100,
        },
        {
          mode: "recent-only",
          scenarioName: "two",
          passed: false,
          notes: ["failed"],
          estimatedPromptTokens: 20,
          latencyMs: 200,
        },
        {
          mode: "snapshot-only",
          scenarioName: "other mode",
          passed: true,
          notes: [],
          estimatedPromptTokens: 100,
          actualInputTokens: 200,
          latencyMs: 300,
        },
      ],
      "recent-only",
    );

    expect(summary).toEqual({
      passed: 1,
      total: 2,
      passRate: 0.5,
      avgEstimatedPromptTokens: 15,
      avgActualInputTokens: 20,
      avgLatencyMs: 150,
    });
  });
});
