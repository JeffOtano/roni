/**
 * PR-local context budget benchmark. Runs existing prompt scenarios in a few
 * context modes and prints pass rate, rough prompt size, actual usage when the
 * provider reports it, and latency. No data is persisted.
 */
import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { escapeTrainingDataTags } from "../../../convex/ai/coach";
import { buildInstructions } from "../../../convex/ai/promptSections";
import { EVAL_SCENARIOS, type EvalScenario } from "../../../convex/ai/evalScenarios";
import { estimateMessagesTokens } from "../../../convex/ai/contextWindow";
import { checkBannedPhrases, checkRubric, normalizeEvalText } from "./lib/rubric";

const MODEL_ID = process.env.CONTEXT_BENCHMARK_MODEL ?? "gemini-3-flash-preview";

const BENCHMARK_MODES = ["recent-only", "snapshot-only", "rag-fallback"] as const;
type BenchmarkMode = (typeof BENCHMARK_MODES)[number];
type GenerateTextArgs = Parameters<typeof generateText>[0];

interface BenchmarkResult {
  mode: BenchmarkMode;
  scenarioName: string;
  passed: boolean;
  notes: string[];
  estimatedPromptTokens: number;
  actualInputTokens?: number;
  latencyMs: number;
}

interface BenchmarkModeSummary {
  passed: number;
  total: number;
  passRate: number;
  avgEstimatedPromptTokens: number;
  avgActualInputTokens?: number;
  avgLatencyMs: number;
}

interface BenchmarkGenerationResult {
  text: string;
  toolCalls?: ReadonlyArray<{ toolName: string }>;
  usage: { inputTokens?: number };
}

type BenchmarkGenerate = (args: GenerateTextArgs) => Promise<BenchmarkGenerationResult>;

interface RunBenchmarkOptions {
  mode?: BenchmarkMode;
  generate?: BenchmarkGenerate;
}

function ensureGoogleKeyOrExit(): void {
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) return;
  console.warn("GOOGLE_GENERATIVE_AI_API_KEY is not set - skipping context budget benchmark.");
  process.exit(0);
}

export function syntheticPriorContext(scenario: EvalScenario): string {
  return [
    `Relevant prior thread for ${scenario.name}: ${scenario.description}`,
    "User previously asked related training questions; preserve any explicit preferences.",
  ].join("\n");
}

export function buildBenchmarkSystem(
  instructions: string,
  scenario: EvalScenario,
  mode: BenchmarkMode,
): string {
  if (mode === "recent-only") return instructions;
  const snapshot = `<training-data>\n${escapeTrainingDataTags(scenario.snapshot)}\n</training-data>`;
  if (mode === "snapshot-only") return `${instructions}\n\n${snapshot}`;
  return `${instructions}\n\n<retrieved-context>\n${syntheticPriorContext(
    scenario,
  )}\n</retrieved-context>\n\n${snapshot}`;
}

export function estimateBenchmarkPromptTokens(system: string, userMessage: string): number {
  return estimateMessagesTokens([
    { role: "system", content: system },
    { role: "user", content: userMessage },
  ]);
}

async function defaultGenerate(args: GenerateTextArgs): Promise<BenchmarkGenerationResult> {
  const result = await generateText(args);
  return {
    text: result.text,
    toolCalls: result.toolCalls.map((toolCall) => ({ toolName: toolCall.toolName })),
    usage: { inputTokens: result.usage.inputTokens },
  };
}

export async function runBenchmarkScenario(
  instructions: string,
  scenario: EvalScenario,
  options: RunBenchmarkOptions = {},
): Promise<BenchmarkResult> {
  const { mode = "recent-only", generate = defaultGenerate } = options;
  const system = buildBenchmarkSystem(instructions, scenario, mode);
  const estimatedPromptTokens = estimateBenchmarkPromptTokens(system, scenario.userMessage);
  const startedAt = Date.now();
  try {
    const result = await generate({
      model: google(MODEL_ID),
      system,
      prompt: scenario.userMessage,
      temperature: 0,
    });
    const toolNames = (result.toolCalls ?? []).map((tc) => tc.toolName).join(" ");
    const text = normalizeEvalText(result.text, toolNames);
    const notes = [...checkRubric(text, scenario.rubric), ...checkBannedPhrases(text)];
    return {
      mode,
      scenarioName: scenario.name,
      passed: notes.length === 0,
      notes,
      estimatedPromptTokens,
      actualInputTokens: result.usage.inputTokens,
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      mode,
      scenarioName: scenario.name,
      passed: false,
      notes: [`generateText threw: ${error instanceof Error ? error.message : String(error)}`],
      estimatedPromptTokens,
      latencyMs: Date.now() - startedAt,
    };
  }
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function summarizeModeResults(
  results: BenchmarkResult[],
  mode: BenchmarkMode,
): BenchmarkModeSummary {
  const rows = results.filter((result) => result.mode === mode);
  const passed = rows.filter((row) => row.passed).length;
  const actualInputRows = rows.flatMap((row) =>
    row.actualInputTokens === undefined ? [] : [row.actualInputTokens],
  );
  return {
    passed,
    total: rows.length,
    passRate: rows.length === 0 ? 0 : passed / rows.length,
    avgEstimatedPromptTokens: average(rows.map((row) => row.estimatedPromptTokens)),
    avgActualInputTokens: actualInputRows.length > 0 ? average(actualInputRows) : undefined,
    avgLatencyMs: average(rows.map((row) => row.latencyMs)),
  };
}

function printModeSummary(results: BenchmarkResult[], mode: BenchmarkMode): void {
  const summary = summarizeModeResults(results, mode);
  console.log(`\n${mode}`);
  console.log(
    `  pass rate: ${summary.passed}/${summary.total} (${(summary.passRate * 100).toFixed(1)}%)`,
  );
  console.log(`  avg estimated prompt tokens: ${summary.avgEstimatedPromptTokens.toFixed(0)}`);
  if (summary.avgActualInputTokens !== undefined) {
    console.log(`  avg actual input tokens: ${summary.avgActualInputTokens.toFixed(0)}`);
  }
  console.log(`  avg latency ms: ${summary.avgLatencyMs.toFixed(0)}`);
}

async function main(): Promise<void> {
  ensureGoogleKeyOrExit();
  const instructions = buildInstructions();
  const results: BenchmarkResult[] = [];
  for (const mode of BENCHMARK_MODES) {
    for (const scenario of EVAL_SCENARIOS) {
      results.push(await runBenchmarkScenario(instructions, scenario, { mode }));
    }
  }

  console.log(`\n=== Context budget benchmark (${MODEL_ID}) ===`);
  for (const mode of BENCHMARK_MODES) printModeSummary(results, mode);

  const failures = results.filter((result) => !result.passed);
  if (failures.length > 0) {
    console.log("\nFailures:");
    for (const failure of failures) {
      console.log(`  - [${failure.mode}] ${failure.scenarioName}`);
      for (const note of failure.notes) console.log(`      ${note}`);
    }
  }
}

function isCliEntrypoint(): boolean {
  return process.argv[1]?.endsWith("runContextBudgetBenchmark.ts") ?? false;
}

if (isCliEntrypoint()) {
  main().catch((error) => {
    console.error("runContextBudgetBenchmark failed:", error);
    process.exit(1);
  });
}
