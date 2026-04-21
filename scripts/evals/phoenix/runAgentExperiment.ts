/**
 * Nightly full-agent experiment. Runs the eval harness against every scenario
 * in the Phoenix dataset, captures traces, and records the experiment in
 * Phoenix Cloud so regressions show up in the Phoenix UI.
 *
 *   PHOENIX_API_KEY=... GOOGLE_GENERATIVE_AI_API_KEY=... npx tsx scripts/evals/phoenix/runAgentExperiment.ts
 *
 * This is intentionally scaffolded: today it uses the prompt-only harness, so
 * the wiring, datasets, and Phoenix experiment plumbing are all testable in CI.
 * Follow the TODO in `convex/ai/evalHarness.ts` to swap in the real Convex
 * dispatch when the nightly agent run is ready.
 */
import { google } from "@ai-sdk/google";
import { createClient } from "@arizeai/phoenix-client";
import { runExperiment } from "@arizeai/phoenix-client/experiments";
import type { Evaluator } from "@arizeai/phoenix-client/types/experiments";
import { createCorrectnessEvaluator } from "@arizeai/phoenix-evals";
import { EVAL_SCENARIOS, type EvalScenario, type Rubric } from "../../../convex/ai/evalScenarios";
import { runScenarioAgainstPrompt } from "../../../convex/ai/evalHarness";
import { BANNED_PHRASES, DEFAULT_MAX_RESPONSE_CHARS } from "./lib/thresholds";

const DATASET_NAME = process.env.PHOENIX_DATASET_NAME ?? "roni-coach-smoke";
const EXPERIMENT_NAME = process.env.PHOENIX_EXPERIMENT_NAME ?? `roni-nightly-${Date.now()}`;

/** Reject NaN/<=0 so Phoenix never sees an invalid concurrency value. */
function positiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    console.warn(`${name}="${raw}" is not a positive integer — using default ${fallback}`);
    return fallback;
  }
  return parsed;
}

function requirePhoenixKey(): string {
  const key = process.env.PHOENIX_API_KEY;
  if (!key) throw new Error("PHOENIX_API_KEY is required to run a Phoenix experiment");
  return key;
}

function resolveBaseUrl(): string {
  return (
    process.env.PHOENIX_COLLECTOR_ENDPOINT ??
    process.env.PHOENIX_HOST ??
    "https://app.phoenix.arize.com"
  );
}

function scenarioByName(name: unknown): EvalScenario | undefined {
  if (typeof name !== "string") return undefined;
  return EVAL_SCENARIOS.find((s) => s.name === name);
}

function rubricChecks(text: string, rubric: Rubric): string[] {
  const notes: string[] = [];
  const lower = text.toLowerCase();
  for (const term of rubric.mustContain ?? []) {
    if (!lower.includes(term.toLowerCase())) notes.push(`missing term: "${term}"`);
  }
  for (const term of rubric.mustNotContain ?? []) {
    if (lower.includes(term.toLowerCase())) notes.push(`forbidden term: "${term}"`);
  }
  for (const pattern of rubric.patterns ?? []) {
    if (!pattern.test(text)) notes.push(`pattern missing: ${pattern}`);
  }
  const maxLen = rubric.maxLength ?? DEFAULT_MAX_RESPONSE_CHARS;
  if (text.length > maxLen) notes.push(`response too long: ${text.length} > ${maxLen}`);
  return notes;
}

const rubricEvaluator: Evaluator = {
  name: "rubric-checks",
  kind: "CODE",
  evaluate: ({ input, output }) => {
    const scenario = scenarioByName((input as { scenarioName?: unknown }).scenarioName);
    if (!scenario) {
      return { score: 0, label: "missing-scenario", explanation: "no source scenario match" };
    }
    // Code rubric intentionally sees tool names — scenarios assert on them
    // (e.g., "must call get_workout_history").
    const notes = rubricChecks(extractTextWithTools(output), scenario.rubric);
    return {
      score: notes.length === 0 ? 1 : 0,
      label: notes.length === 0 ? "pass" : "fail",
      explanation: notes.join("; ") || "all rubric checks passed",
    };
  },
};

function getOutputParts(output: unknown): { text: string; toolNames: string } {
  if (typeof output === "string") return { text: output, toolNames: "" };
  if (output && typeof output === "object") {
    const outputObj = output as { text?: unknown; toolNames?: unknown };
    const text = typeof outputObj.text === "string" ? outputObj.text : "";
    const toolNames = Array.isArray(outputObj.toolNames) ? outputObj.toolNames.join(" ") : "";
    return { text, toolNames };
  }
  return { text: JSON.stringify(output ?? ""), toolNames: "" };
}

/** Prose + tool names, for code-based rubric and banned-phrase checks. */
function extractTextWithTools(output: unknown): string {
  const { text, toolNames } = getOutputParts(output);
  return [text, toolNames].filter(Boolean).join("\n");
}

/** Prose only, for the LLM judge — tool names would pollute prose evaluation. */
function extractJudgeText(output: unknown): string {
  return getOutputParts(output).text;
}

const bannedPhraseEvaluator: Evaluator = {
  name: "banned-phrases",
  kind: "CODE",
  evaluate: ({ output }) => {
    // Ban phrases anywhere the user could see — including tool-call surfacing.
    const text = extractTextWithTools(output);
    const lower = text.toLowerCase();
    const hits = BANNED_PHRASES.filter((p) => lower.includes(p));
    return {
      score: hits.length === 0 ? 1 : 0,
      label: hits.length === 0 ? "clean" : "banned-phrase",
      explanation: hits.length === 0 ? "no banned phrases" : `found: ${hits.join(", ")}`,
    };
  },
};

async function main(): Promise<void> {
  const apiKey = requirePhoenixKey();
  const baseUrl = resolveBaseUrl();

  const client = createClient({
    options: {
      baseUrl,
      headers: { Authorization: `Bearer ${apiKey}` },
    },
  });

  // LLM-judge for transcript quality — catches persona drift the code rubric misses.
  const correctnessJudge = createCorrectnessEvaluator({
    model: google(process.env.PHOENIX_JUDGE_MODEL ?? "gemini-2.5-flash"),
  });
  const correctnessEvaluator: Evaluator = {
    name: "coach-correctness",
    kind: "LLM",
    evaluate: async ({ input, output }) => {
      const scenario = scenarioByName((input as { scenarioName?: unknown }).scenarioName);
      const question = scenario?.userMessage ?? "";
      // Judge sees prose only — tool names would distort prose quality scoring.
      return correctnessJudge.evaluate({ input: question, output: extractJudgeText(output) });
    },
  };

  const ran = await runExperiment({
    client,
    experimentName: EXPERIMENT_NAME,
    experimentDescription: "Roni nightly agent eval (prompt-only scaffold; see evalHarness TODO)",
    experimentMetadata: { codepath: "evalHarness.runScenarioAgainstPrompt" },
    dataset: { datasetName: DATASET_NAME },
    task: async (example) => {
      const scenarioName = (example.input as { scenarioName?: string }).scenarioName;
      const scenario = scenarioByName(scenarioName);
      if (!scenario) {
        return { error: `scenario "${scenarioName}" not found in source evalScenarios.ts` };
      }
      const result = await runScenarioAgainstPrompt(scenario);
      return {
        text: result.text,
        toolNames: result.toolNames,
        modelId: result.modelId,
      };
    },
    evaluators: [rubricEvaluator, bannedPhraseEvaluator, correctnessEvaluator],
    concurrency: positiveIntEnv("PHOENIX_EXPERIMENT_CONCURRENCY", 2),
  });

  const failed = ran.failedRunCount;
  const total = ran.exampleCount;
  console.log(`Experiment ${ran.id}: ${total - failed}/${total} successful runs`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error("runAgentExperiment failed:", error);
  process.exit(1);
});
