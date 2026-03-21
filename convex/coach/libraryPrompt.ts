import { z } from "zod";
import { getGoalLabel, getMaxExercises, getRepSetScheme, getSessionTypeLabel } from "./goalConfig";
import type { LibraryGoal, LibraryLevel } from "./goalConfig";
import { SESSION_TYPE_MUSCLES } from "./weekProgrammingHelpers";
import type { LibraryCombo } from "./libraryGeneration";
import type { Movement } from "../tonal/types";

export const llmWorkoutSchema = z.object({
  exercises: z
    .array(
      z.object({
        movementId: z.string(),
        sets: z.number(),
        reps: z.number().optional(),
        duration: z.number().optional().describe("Seconds, for duration-based exercises"),
        coachingCue: z.string().describe("One-line Tonal-specific form tip for this exercise"),
      }),
    )
    .describe("Exercise prescriptions in workout order with VARIED sets/reps"),
  description: z.string().describe("2-3 sentence workout description for the page"),
  metaDescription: z.string().describe("SEO meta description under 155 characters"),
  restGuidance: z.string().describe("Brief rest period guidance tailored to the goal"),
  workoutRationale: z
    .string()
    .describe(
      "2-3 sentences explaining why the exercises are ordered this way and how they work together on Tonal",
    ),
  whoIsThisFor: z
    .string()
    .describe(
      "1-2 sentences describing the ideal athlete for this workout, referencing specific goals or sports",
    ),
  faq: z
    .array(z.object({ question: z.string(), answer: z.string() }))
    .describe("3-4 Tonal-specific Q&As about this workout"),
});

export type LlmWorkoutOutput = z.infer<typeof llmWorkoutSchema>;

const LEVEL_GUIDANCE: Record<LibraryLevel, string> = {
  beginner:
    "Use moderate reps (10-15) with controlled tempo. Prioritize simple compound movements. Avoid complex unilateral or stability-demanding exercises.",
  intermediate:
    "Mix rep ranges: compounds at 8-10 reps, accessories at 10-12, finishers at 12-15. Include some unilateral work.",
  advanced:
    "Vary rep ranges significantly: heavy compounds at 4-6 reps with more sets, moderate accessories at 8-10, burnout/isolation finishers at 12-15. Include advanced movements and challenging variations.",
};

const GOAL_REP_GUIDANCE: Record<LibraryGoal, string> = {
  build_muscle:
    "Hypertrophy focus: 3-4 sets on compounds (8-12 reps), 2-3 sets on isolations (10-15 reps). Total volume matters.",
  fat_loss:
    "Circuit-style: 3 sets, 12-15 reps, minimal rest. Pair exercises as supersets wherever possible.",
  strength:
    "Strength focus: 4-5 sets on main compounds (3-6 reps), 3 sets on accessories (8-10 reps). Heavy loads, full rest.",
  endurance: "Endurance focus: 2-3 sets, 15-20 reps. Keep moving. Light resistance, high volume.",
  athletic:
    "Athletic focus: 3-4 sets, 6-8 reps on power movements, 3 sets of 10-12 on accessories.",
  general_fitness: "Balanced: 3 sets, mix of 8-12 reps. Straightforward and accessible.",
  power:
    "Power focus: 4-5 sets of 2-4 reps on main lifts (explosive intent), 3 sets of 6-8 on supporting work.",
  functional:
    "Functional: 3 sets, 10-12 reps. Emphasize compound multi-joint movements and unilateral balance work.",
  mobility_flexibility: "Mobility: 2 sets, 30-45 second holds. Slow, controlled movement.",
  sport_complement:
    "Sport complement: 3 sets, 8-10 reps. Focus on injury prevention areas and unilateral strength.",
};

function formatCatalogForPrompt(catalog: Movement[]): string {
  return catalog
    .map((m) => {
      const accessory = m.onMachineInfo?.accessory ?? "bodyweight";
      const type = m.countReps ? "reps" : "duration";
      return `${m.id} | ${m.name} | ${m.muscleGroups.join(", ")} | ${accessory} | ${type} | skill:${m.skillLevel}`;
    })
    .join("\n");
}

export function buildWorkoutPrompt(
  combo: LibraryCombo,
  filteredCatalog: Movement[],
  recentMovementIds: string[],
): string {
  const { sessionType, goal, durationMinutes, level, equipmentConfig } = combo;
  const targetMuscles = SESSION_TYPE_MUSCLES[sessionType] ?? [];
  const maxExercises = getMaxExercises(durationMinutes);
  const scheme = getRepSetScheme(goal);
  const sessionLabel = getSessionTypeLabel(sessionType);
  const goalLabel = getGoalLabel(goal);

  const recentNote =
    recentMovementIds.length > 0
      ? `\nAvoid these recently used movement IDs if possible (for variety): ${recentMovementIds.slice(0, 20).join(", ")}`
      : "";

  return `You are an expert strength coach designing a Tonal workout for a real person. This must look like it was programmed by a knowledgeable coach, not auto-generated.

WORKOUT PARAMETERS:
- Session: ${sessionLabel} (target muscles: ${targetMuscles.join(", ")})
- Goal: ${goalLabel}
- Duration: ${durationMinutes} minutes (select ${maxExercises} exercises max)
- Level: ${level}
- Equipment: ${equipmentConfig.replace(/_/g, " ")}
- Default scheme reference: ${scheme.sets} sets x ${scheme.reps ? `${scheme.reps} reps` : `${scheme.duration}s`}

REP SCHEME GUIDANCE (CRITICAL - DO NOT USE IDENTICAL REPS ON EVERY EXERCISE):
${GOAL_REP_GUIDANCE[goal]}
${LEVEL_GUIDANCE[level]}
Every exercise MUST have its own sets/reps prescription based on its role in the workout:
- Lead compound: more sets, moderate-to-low reps
- Secondary compound: standard sets/reps
- Isolation/accessory: fewer sets, higher reps
- Finisher: high reps or burnout
DO NOT assign the same sets x reps to every exercise. That looks auto-generated and kills credibility.

EXERCISE SELECTION RULES:
- Pick ONLY from the movement catalog below. Use exact movement IDs.
- Start with compound movements (multi-joint, multiple muscle groups), then isolation.
- Group exercises that use the same accessory together to minimize equipment switches.
- For supersets, pair exercises that work different movement patterns (e.g., push + pull, or agonist + antagonist).
- Skill level 1 = beginner, 2 = intermediate, 3 = advanced. For ${level} lifters, use movements with skill level <= ${level === "beginner" ? 2 : 3}.
- Duration-based exercises (type=duration) should use duration in seconds (30-45s), not reps.
${recentNote}

REST GUIDANCE:
- Include a brief rest recommendation in restGuidance (e.g., "Rest 90-120s between heavy compound sets, 60-90s between accessories, 30-45s during supersets").
- Tailor rest periods to the goal: strength = longer rest (2-3 min), hypertrophy = moderate (60-90s), fat loss/endurance = minimal (30-45s).

COACHING CUES:
- For each exercise, write a one-line Tonal-specific coaching cue. Reference the cable system, digital weight, smart handles/bar, or bench when relevant.
- Examples: "Keep constant tension on the cables through the full range of motion" or "Use Tonal's eccentric mode to control the negative for 3 seconds."
- Make cues actionable and specific to the movement, not generic.

CONTENT RULES:
- description: 2-3 sentences that sell the workout. What it targets, why the exercise selection matters, who it's for. Write in second person ("you"). No em dashes. Be specific about the training approach.
- metaDescription: Under 155 characters for SEO. Include "Tonal workout" and the key attributes.
- workoutRationale: 2-3 sentences explaining WHY the exercises are in this order and how they work together on Tonal. Reference programming concepts (compound-to-isolation, pre-exhaust, superset pairings, equipment grouping).
- whoIsThisFor: 1-2 sentences describing the ideal athlete. Be specific - mention sports, goals, experience, or lifestyle (e.g., "runners looking to build knee stability" or "busy professionals who want maximum results in minimal time").
- faq: Generate 3-4 Q&As that a Tonal owner would actually ask about this workout. Questions should be practical ("What weight should I start with?", "Can I substitute the bench exercises?", "How often should I do this workout?"). Answers should reference Tonal features (digital weight, smart accessories, spotter mode) where relevant.

AVAILABLE EXERCISES:
id | name | muscles | accessory | type | skill
${formatCatalogForPrompt(filteredCatalog)}`;
}
