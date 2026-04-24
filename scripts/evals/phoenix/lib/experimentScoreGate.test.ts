import type { ExperimentEvaluationRun } from "@arizeai/phoenix-client/types/experiments";
import { describe, expect, it } from "vitest";
import { findScoreGateRegressions, formatScoreGateSummary } from "./experimentScoreGate";

function evaluationRun(overrides: Partial<ExperimentEvaluationRun>): ExperimentEvaluationRun {
  return {
    id: "eval-1",
    experimentRunId: "run-1",
    startTime: new Date(0),
    endTime: new Date(1),
    name: "rubric-checks",
    annotatorKind: "CODE",
    error: null,
    result: { score: 1, label: "pass", explanation: "ok" },
    traceId: null,
    ...overrides,
  };
}

describe("findScoreGateRegressions", () => {
  it("returns no regressions when evaluation runs are missing", () => {
    expect(findScoreGateRegressions(undefined)).toEqual([]);
  });

  it("returns gated evaluator runs with score zero", () => {
    const regressions = findScoreGateRegressions([
      evaluationRun({
        id: "eval-2",
        experimentRunId: "run-2",
        name: "banned-phrases",
        result: { score: 0, label: "banned-phrase", explanation: "found: disclaimer" },
      }),
    ]);

    expect(regressions).toEqual([
      {
        evaluatorName: "banned-phrases",
        evaluationRunId: "eval-2",
        experimentRunId: "run-2",
        explanation: "found: disclaimer",
      },
    ]);
  });

  it("ignores passing and non-gated evaluator runs", () => {
    const regressions = findScoreGateRegressions([
      evaluationRun({ result: { score: 1, label: "pass" } }),
      evaluationRun({ id: "eval-3", name: "diagnostic-only", result: { score: 0 } }),
    ]);

    expect(regressions).toEqual([]);
  });
});

describe("formatScoreGateSummary", () => {
  it("summarizes evaluator counts and failed runs", () => {
    const summary = formatScoreGateSummary([
      {
        evaluatorName: "rubric-checks",
        evaluationRunId: "eval-1",
        experimentRunId: "run-1",
        explanation: "missing term",
      },
      {
        evaluatorName: "rubric-checks",
        evaluationRunId: "eval-2",
        experimentRunId: "run-2",
        explanation: "response too long",
      },
      {
        evaluatorName: "coach-correctness",
        evaluationRunId: "eval-3",
        experimentRunId: "run-3",
        explanation: "low quality",
      },
    ]);

    expect(summary).toContain("rubric-checks=2");
    expect(summary).toContain("coach-correctness=1");
    expect(summary).toContain("rubric-checks run=run-1 eval=eval-1: missing term");
  });
});
