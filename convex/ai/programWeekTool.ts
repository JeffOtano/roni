/**
 * AI agent tool for generating a draft week plan.
 *
 * Wraps `internal.coach.weekProgramming.generateDraftWeekPlan` and surfaces
 * any per-day degenerate exercise selection back to the LLM via reasoningHints.
 */

import { createTool } from "@convex-dev/agent";
import { z } from "zod";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { DraftWeekSummary } from "../coach/weekProgrammingHelpers";
import { getWeekStartDateString } from "../weekPlanHelpers";
import { requireUserId, withToolTracking } from "./helpers";
import { buildReasoningPrompt } from "./weekReasoning";

const ALLOWED_SESSION_DURATIONS = [30, 45, 60] as const;
type SessionDuration = (typeof ALLOWED_SESSION_DURATIONS)[number];

function validateSessionDuration(value: unknown): SessionDuration | undefined {
  const parsed =
    typeof value === "number" ? value : typeof value === "string" ? parseInt(value, 10) : undefined;
  if (Number.isInteger(parsed) && ALLOWED_SESSION_DURATIONS.includes(parsed as SessionDuration)) {
    return parsed as SessionDuration;
  }
  return undefined;
}

export const programWeekTool = createTool({
  description: `Program the user's full training week. Creates draft workouts for each training day based on their split, available days, and session duration.

IMPORTANT: The backend algorithm selects the exact exercises, sets, and reps — you do NOT. Your job is to call this tool, then faithfully describe what it returned in the \`summary\` field. Never pre-announce specific exercises before calling this tool (e.g. "I'll program bench press, rows, and squats..."), because the algorithm may pick differently based on user history, muscle readiness, injuries, and progressive overload. Never describe exercise names, sets, or reps that are not present in the returned \`summary\`.

Duration-based movements in the summary use a duration (seconds) instead of reps. Describe them in seconds (e.g. "30s hold") — never as "4x10".

Returns a summary of the full week plan with exercises, sets, reps/duration, and progressive overload targets. The plan is NOT pushed to Tonal yet — present it to the user for approval first, then use approve_week_plan. If the user already has saved preferences, you can omit the parameters to use their saved preferences.`,
  inputSchema: z.object({
    preferredSplit: z
      .enum(["ppl", "upper_lower", "full_body", "bro_split"])
      .optional()
      .describe(
        "Training split. ppl = Push/Pull/Legs, upper_lower = Upper/Lower, full_body = Full Body, bro_split = Bodybuilding body-part split (Chest/Back/Shoulders/Arms/Legs). Omit to use saved preferences.",
      ),
    trainingDays: z
      .array(z.number().int().min(0).max(6))
      .optional()
      .describe(
        "Day indices: 0=Monday, 1=Tuesday, ..., 6=Sunday. Omit to auto-space based on count.",
      ),
    targetDays: z
      .number()
      .int()
      .min(1)
      .max(7)
      .optional()
      .describe("Number of training days per week (used if trainingDays is omitted)."),
    sessionDurationMinutes: z
      .enum(["30", "45", "60"])
      .optional()
      .describe("Session duration. Omit to use saved preferences."),
  }),
  execute: withToolTracking(
    "program_week",
    async (
      ctx,
      input,
      _options,
    ): Promise<
      | {
          success: true;
          weekPlanId: string;
          summary: DraftWeekSummary;
          reasoningHints: string;
          degenerateDays?: {
            dayIndex: number;
            dayName: string;
            eliminatedByInjury: number;
            eliminatedByAccessory: number;
          }[];
        }
      | { success: false; error: string }
    > => {
      const userId = requireUserId(ctx);

      // Load saved preferences as defaults
      const saved = (await ctx.runQuery(internal.userProfiles.getTrainingPreferencesInternal, {
        userId,
      })) as {
        preferredSplit?: "ppl" | "upper_lower" | "full_body" | "bro_split";
        trainingDays?: number[];
        sessionDurationMinutes?: number;
      } | null;

      const preferredSplit = input.preferredSplit ?? saved?.preferredSplit ?? "ppl";
      const inputDuration = validateSessionDuration(input.sessionDurationMinutes);
      const savedDuration = validateSessionDuration(saved?.sessionDurationMinutes);
      const sessionDuration = inputDuration ?? savedDuration ?? 45;

      const targetDays =
        input.trainingDays?.length ?? input.targetDays ?? saved?.trainingDays?.length ?? 3;

      const result = (await ctx.runAction(internal.coach.weekProgramming.generateDraftWeekPlan, {
        userId,
        weekStartDate: getWeekStartDateString(new Date()),
        preferredSplit,
        targetDays,
        sessionDurationMinutes: sessionDuration,
        trainingDayIndicesOverride: input.trainingDays ?? saved?.trainingDays,
      })) as
        | {
            success: true;
            weekPlanId: Id<"weekPlans">;
            summary: DraftWeekSummary;
            degenerateDays: {
              dayIndex: number;
              dayName: string;
              eliminatedByInjury: number;
              eliminatedByAccessory: number;
            }[];
          }
        | { success: false; error: string };

      if (!result.success) return result;

      // Build lightweight reasoning hints from data already in scope.
      // The AI agent has the full training snapshot (muscle readiness,
      // injuries, feedback) in its context — no need to duplicate here.
      const reasoningHints = buildReasoningPrompt({
        split: preferredSplit,
        targetDays,
        sessionDuration,
        muscleReadiness: {},
        recentWorkouts: [],
        activeInjuries: [],
        recentFeedback: null,
        isDeload: false,
      });

      const degenerateNote =
        result.degenerateDays.length > 0
          ? `\n\nWARNING: ${result.degenerateDays.length} day(s) had to be programmed with a heavily-restricted exercise pool because of injury filters. Affected days: ${result.degenerateDays.map((d) => d.dayName).join(", ")}. The plan may feel monotonous. Consider asking the user to relax their injury list or use search_exercises to find alternative compound movements.`
          : "";

      return { ...result, reasoningHints: reasoningHints + degenerateNote };
    },
  ),
});
