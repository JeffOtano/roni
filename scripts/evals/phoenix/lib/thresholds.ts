/**
 * Per-capability thresholds for the AI coach smoke evals.
 *
 * The PR smoke job fails when either:
 *   - the overall pass rate drops below {@link OVERALL_PASS_RATE}, or
 *   - any single capability drops below its per-capability floor.
 *
 * Keep thresholds conservative so a one-off flaky Gemini response doesn't
 * block a PR; raise them once the evals are green for a week.
 */
import type { Capability } from "../../../../convex/ai/evalScenarios";

export const OVERALL_PASS_RATE = 0.8;

export const CAPABILITY_PASS_RATE: Record<Capability, number> = {
  weekly_programming: 0.75,
  approval_and_push: 0.75,
  exercise_qa: 0.75,
  progress_analysis: 0.75,
  recovery_and_deload: 0.75,
  failure_recovery: 0.75,
};

/** Hard ceiling on response length — scenario-level rubrics can override. */
export const DEFAULT_MAX_RESPONSE_CHARS = 4000;

/** Phrases the coach must never emit. Checked by the banned-phrase eval. */
export const BANNED_PHRASES: readonly string[] = [
  "as an ai language model",
  "i cannot provide",
  "i don't have personal experience",
  "i am just an ai",
  "disclaimer:",
];
