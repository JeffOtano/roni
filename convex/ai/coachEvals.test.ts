/**
 * LLM eval scenarios for the AI coach prompt.
 * These tests call the actual LLM. Run manually with:
 *   GOOGLE_GENERATIVE_AI_API_KEY=... npx vitest run convex/ai/coachEvals.test.ts
 *
 * Scenarios live in `./evalScenarios.ts` and are shared with the Phoenix Cloud
 * eval pipeline under `scripts/evals/phoenix/`.
 */
import { describe, expect, test } from "vitest";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { buildInstructions } from "./promptSections";
import { EVAL_SCENARIOS, type EvalScenario } from "./evalScenarios";

const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const describeIfKey = apiKey ? describe : describe.skip;

const instructions = buildInstructions();

async function runScenario(scenario: EvalScenario): Promise<void> {
  const system = `${instructions}\n\n<training-data>\n${scenario.snapshot}\n</training-data>`;
  const result = await generateText({
    model: google("gemini-3-flash-preview"),
    system,
    prompt: scenario.userMessage,
    temperature: 0,
  });
  // Include tool call names in the text for rubric matching —
  // when the model tries to call tools (unavailable in this test),
  // the text body may be empty but the intent is visible in toolCalls.
  const toolNames = (result.toolCalls ?? []).map((tc) => tc.toolName).join(" ");
  // Strip internal thinking/reasoning blocks that Gemini sometimes emits.
  // These may reference avoided items while reasoning about avoidance.
  const responseText = result.text.replace(
    /\*\*(?:Thinking Process|Tool Calls|Reasoning):\*\*[\s\S]*?(?=```|How does|Ready to|Let me know|$)/gi,
    "",
  );
  const text = [responseText, toolNames].filter(Boolean).join("\n");

  const lower = text.toLowerCase();
  const { rubric } = scenario;

  for (const term of rubric.mustContain ?? []) {
    expect(lower, `Response must contain "${term}". Got:\n${text}`).toContain(term.toLowerCase());
  }
  for (const term of rubric.mustNotContain ?? []) {
    expect(lower, `Response must NOT contain "${term}". Got:\n${text}`).not.toContain(
      term.toLowerCase(),
    );
  }
  for (const pattern of rubric.patterns ?? []) {
    expect(text, `Response must match ${pattern}. Got:\n${text}`).toMatch(pattern);
  }
  if (rubric.maxLength !== undefined) {
    expect(
      text.length,
      `Response too long (${text.length} > ${rubric.maxLength}). Got:\n${text}`,
    ).toBeLessThanOrEqual(rubric.maxLength);
  }
}

describeIfKey("coach prompt evals (LLM)", { timeout: 120_000 }, () => {
  for (const scenario of EVAL_SCENARIOS) {
    test.concurrent(scenario.name, () => runScenario(scenario), 60_000);
  }
});
