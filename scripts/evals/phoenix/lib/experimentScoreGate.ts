import type { ExperimentEvaluationRun } from "@arizeai/phoenix-client/types/experiments";

export const SCORE_GATED_EVALUATOR_NAMES = [
  "rubric-checks",
  "banned-phrases",
  "coach-correctness",
] as const;

export type EvaluatorRegression = {
  evaluatorName: string;
  evaluationRunId: string;
  experimentRunId: string;
  explanation: string;
};

export function findScoreGateRegressions(
  evaluationRuns: readonly ExperimentEvaluationRun[] | undefined,
  gatedEvaluatorNames: readonly string[] = SCORE_GATED_EVALUATOR_NAMES,
): EvaluatorRegression[] {
  const gatedEvaluatorNameSet = new Set(gatedEvaluatorNames);

  return (evaluationRuns ?? []).flatMap((run) => {
    if (!gatedEvaluatorNameSet.has(run.name)) return [];
    if (run.result?.score !== 0) return [];

    return [
      {
        evaluatorName: run.name,
        evaluationRunId: run.id,
        experimentRunId: run.experimentRunId,
        explanation: run.result.explanation ?? run.result.label ?? run.error ?? "score=0",
      },
    ];
  });
}

export function formatScoreGateSummary(regressions: readonly EvaluatorRegression[]): string {
  if (regressions.length === 0) return "Evaluator score gate: passed";

  const countsByEvaluator = new Map<string, number>();
  for (const regression of regressions) {
    countsByEvaluator.set(
      regression.evaluatorName,
      (countsByEvaluator.get(regression.evaluatorName) ?? 0) + 1,
    );
  }

  const countSummary = Array.from(countsByEvaluator.entries())
    .map(([name, count]) => `${name}=${count}`)
    .join(", ");
  const details = regressions
    .map(
      (regression) =>
        `${regression.evaluatorName} run=${regression.experimentRunId} eval=${regression.evaluationRunId}: ${regression.explanation}`,
    )
    .join("\n");

  return `Evaluator score gate failed: ${countSummary}\n${details}`;
}
