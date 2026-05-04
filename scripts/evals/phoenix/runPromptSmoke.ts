/**
 * Prompt-only smoke evals for the AI coach. Runs against Gemini with temperature
 * 0 and no tool access, checking the response against each scenario's rubric
 * plus a shared banned-phrase check.
 *
 * Behaviour:
 *   - Streams runs in small batches so a flaky Gemini response doesn't stall the PR.
 *   - Pipes results to stdout for CI logs and exits non-zero when thresholds fail.
 *   - Optionally publishes results to Phoenix Cloud as a tag on the trace (best
 *     effort; eval runs still pass/fail locally even if Phoenix is unreachable).
 *
 *   GOOGLE_GENERATIVE_AI_API_KEY=... npm run ai:eval:smoke
 */
import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { buildInstructions } from "../../../convex/ai/promptSections";
import { EVAL_SCENARIOS, type EvalScenario } from "../../../convex/ai/evalScenarios";
import { decide, printReport, type Report, type ScenarioResult } from "./lib/report";
import { checkBannedPhrases, checkRubric, normalizeEvalText } from "./lib/rubric";

const MODEL_ID = process.env.PHOENIX_SMOKE_MODEL ?? "gemini-3-flash-preview";

/** Positive-integer env guard. `Number("abc")` is NaN and `Number("-4")` is negative
 *  — both would hang `runAll` by never advancing `i`. Fall back to `fallback`. */
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
const CONCURRENCY = positiveIntEnv("PHOENIX_SMOKE_CONCURRENCY", 4);

/**
 * Fork PRs from contributors don't get repo secrets, so the CI job runs with
 * an empty key. Exit 0 with a clear warning in that case — we'd rather skip
 * the eval than mark the PR failed when the contributor cannot fix it.
 */
function ensureGoogleKeyOrExit(): void {
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) return;
  console.warn("GOOGLE_GENERATIVE_AI_API_KEY is not set — skipping prompt smoke evals.");
  process.exit(0);
}

async function runOne(instructions: string, scenario: EvalScenario): Promise<ScenarioResult> {
  const system = `${instructions}\n\n<training-data>\n${scenario.snapshot}\n</training-data>`;
  try {
    const result = await generateText({
      model: google(MODEL_ID),
      system,
      prompt: scenario.userMessage,
      temperature: 0,
    });
    const toolNames = (result.toolCalls ?? []).map((tc) => tc.toolName).join(" ");
    const text = normalizeEvalText(result.text, toolNames);
    const notes = [...checkRubric(text, scenario.rubric), ...checkBannedPhrases(text)];
    return {
      name: scenario.name,
      capability: scenario.capability,
      passed: notes.length === 0,
      notes,
    };
  } catch (error) {
    return {
      name: scenario.name,
      capability: scenario.capability,
      passed: false,
      notes: [`generateText threw: ${error instanceof Error ? error.message : String(error)}`],
    };
  }
}

async function runAll(instructions: string): Promise<Report> {
  const results: ScenarioResult[] = [];
  for (let i = 0; i < EVAL_SCENARIOS.length; i += CONCURRENCY) {
    const batch = EVAL_SCENARIOS.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(batch.map((s) => runOne(instructions, s)));
    results.push(...batchResults);
  }
  return {
    total: results.length,
    passed: results.filter((r) => r.passed).length,
    results,
  };
}

async function main(): Promise<void> {
  ensureGoogleKeyOrExit();
  const instructions = buildInstructions();
  const report = await runAll(instructions);
  printReport(report);
  const decision = decide(report);
  if (!decision.passed) {
    console.error("\nFAIL — thresholds not met:");
    for (const reason of decision.reasons) console.error(`  - ${reason}`);
    process.exit(1);
  }
  console.log("\nPASS — all capability thresholds met");
}

main().catch((error) => {
  console.error("runPromptSmoke failed:", error);
  process.exit(1);
});
