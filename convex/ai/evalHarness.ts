/**
 * Full-agent eval harness.
 *
 * The PR-time `runPromptSmoke` script runs prompt-only scenarios against
 * Gemini with no tool access. This harness is the scaffold for the nightly
 * "real agent" run where scenarios exercise tool calls, Convex state, and
 * the full `streamWithRetry` path.
 *
 * Today this module exposes the contracts and a minimal task implementation
 * so the Phoenix experiment scaffolding can compile and run in CI without
 * hitting Convex. Wire the real Convex dispatch in a follow-up:
 *   - seed scenario state (users, tonalCache, history) before each example
 *   - invoke `processMessage` / `continueAfterApproval` via ConvexHttpClient
 *   - pull the final `aiRun` row back via a query for assertion
 *
 * Keep this file thin; scenario definitions live in `./evalScenarios.ts`.
 */
import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { buildInstructions } from "./promptSections";
import type { EvalScenario } from "./evalScenarios";

export interface HarnessResult {
  /** Full assistant response text, trimmed. */
  text: string;
  /** Names of tools the model asked to call, in sequence. */
  toolNames: string[];
  /** Model id that produced the response. */
  modelId: string;
  /** Optional trace id from Phoenix (populated when Phoenix is configured). */
  runId?: string;
}

export interface HarnessOptions {
  /** Override the model used for the agent run; defaults to the flash preview. */
  modelId?: string;
}

/**
 * Minimal prompt-only "task" implementation. Safe to run inside Phoenix's
 * `runExperiment` because it only touches Gemini + our instructions string.
 * Replace this with a Convex-driven dispatch when the nightly harness is wired.
 */
export async function runScenarioAgainstPrompt(
  scenario: EvalScenario,
  options: HarnessOptions = {},
): Promise<HarnessResult> {
  const modelId = options.modelId ?? "gemini-3-flash-preview";
  const system = `${buildInstructions()}\n\n<training-data>\n${scenario.snapshot}\n</training-data>`;
  const result = await generateText({
    model: google(modelId),
    system,
    prompt: scenario.userMessage,
    temperature: 0,
  });
  return {
    text: result.text.trim(),
    toolNames: (result.toolCalls ?? []).map((t) => t.toolName),
    modelId,
  };
}

// TODO(nightly-harness): wire Convex dispatch.
//   1. `import { ConvexHttpClient } from "convex/browser"` in the script (not here).
//   2. Seed: ensure scenario users/tonalCache/workoutPlans exist for the scenario.
//   3. Dispatch: invoke `internal.chatProcessing.processMessage` via an admin
//      client token, then poll the agent thread for the final assistant message.
//   4. Verify: read back the `aiRun` row by `runId` to confirm tool sequence
//      and finishReason match the scenario's expectations.
//   5. Return `{ text, toolNames, modelId, runId }` so the Phoenix evaluator can
//      attach the trace to each example row.
