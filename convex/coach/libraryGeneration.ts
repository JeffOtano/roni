import { generateText, Output } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import {
  generateMetaTitle,
  generateSlug,
  generateTitle,
  getExcludedAccessoriesForConfig,
  getGoalLabel,
  getMaxExercises,
  getRepSetScheme,
  getSessionTypeLabel,
} from "./goalConfig";
import type {
  LibraryDuration,
  LibraryEquipmentConfig,
  LibraryGoal,
  LibraryLevel,
  LibrarySessionType,
} from "./goalConfig";
import {
  blocksFromMovementIds,
  SESSION_TYPE_MUSCLES,
  sortForMinimalEquipmentSwitches,
} from "./weekProgrammingHelpers";
import type { Movement } from "../tonal/types";

export interface LibraryCombo {
  sessionType: LibrarySessionType;
  goal: LibraryGoal;
  durationMinutes: LibraryDuration;
  level: LibraryLevel;
  equipmentConfig: LibraryEquipmentConfig;
}

const ALL_SESSION_TYPES: LibrarySessionType[] = [
  "push",
  "pull",
  "legs",
  "upper",
  "lower",
  "full_body",
  "chest",
  "back",
  "shoulders",
  "arms",
  "core",
  "glutes_hamstrings",
  "chest_back",
  "mobility",
  "recovery",
];

const ALL_GOALS: LibraryGoal[] = [
  "build_muscle",
  "fat_loss",
  "strength",
  "endurance",
  "athletic",
  "general_fitness",
  "power",
  "functional",
  "mobility_flexibility",
  "sport_complement",
];

const ALL_DURATIONS: LibraryDuration[] = [20, 30, 45, 60];
const ALL_LEVELS: LibraryLevel[] = ["beginner", "intermediate", "advanced"];
const ALL_EQUIPMENT: LibraryEquipmentConfig[] = [
  "handles_only",
  "handles_bar",
  "full_accessories",
  "bodyweight_only",
];

export function isValidCombo(combo: LibraryCombo): boolean {
  const { sessionType, goal, durationMinutes, level, equipmentConfig } = combo;

  if (
    equipmentConfig === "bodyweight_only" &&
    !["full_body", "core", "legs", "glutes_hamstrings", "mobility", "recovery"].includes(
      sessionType,
    )
  ) {
    return false;
  }
  if (goal === "endurance" && durationMinutes === 60) return false;
  if ((goal === "strength" || goal === "power") && level === "beginner") return false;
  if (goal === "power" && durationMinutes === 20) return false;
  if (
    (sessionType === "mobility" || sessionType === "recovery") &&
    goal !== "mobility_flexibility" &&
    goal !== "functional"
  ) {
    return false;
  }
  if (
    goal === "sport_complement" &&
    !["full_body", "upper", "lower", "legs", "glutes_hamstrings", "core"].includes(sessionType)
  ) {
    return false;
  }
  if (
    goal === "mobility_flexibility" &&
    !["full_body", "mobility", "recovery", "core"].includes(sessionType)
  ) {
    return false;
  }
  if (durationMinutes === 20 && sessionType === "full_body" && goal === "strength") return false;

  return true;
}

export function enumerateValidCombos(): LibraryCombo[] {
  return ALL_SESSION_TYPES.flatMap((sessionType) =>
    ALL_GOALS.flatMap((goal) =>
      ALL_DURATIONS.flatMap((durationMinutes) =>
        ALL_LEVELS.flatMap((level) =>
          ALL_EQUIPMENT.map((equipmentConfig) => ({
            sessionType,
            goal,
            durationMinutes,
            level,
            equipmentConfig,
          })),
        ),
      ),
    ),
  ).filter(isValidCombo);
}

// ---------------------------------------------------------------------------
// LLM-driven workout builder
// ---------------------------------------------------------------------------

const MOBILITY_TRAINING_TYPES = ["Mobility", "Yoga"];
const RECOVERY_TRAINING_TYPES = ["Recovery", "Yoga"];

export interface MovementDetail {
  movementId: string;
  name: string;
  shortName: string;
  muscleGroups: string[];
  sets: number;
  reps?: number;
  duration?: number;
  phase: "warmup" | "main" | "cooldown";
  thumbnailMediaUrl?: string;
  accessory?: string;
}

export interface LibraryWorkoutData {
  slug: string;
  title: string;
  description: string;
  sessionType: LibrarySessionType;
  goal: LibraryGoal;
  durationMinutes: LibraryDuration;
  level: LibraryLevel;
  equipmentConfig: LibraryEquipmentConfig;
  blocks: ReturnType<typeof blocksFromMovementIds>;
  movementDetails: MovementDetail[];
  targetMuscleGroups: string[];
  exerciseCount: number;
  totalSets: number;
  equipmentNeeded: string[];
  metaTitle: string;
  metaDescription: string;
  restGuidance: string;
  generationVersion: number;
  createdAt: number;
}

export interface BuildLibraryWorkoutInput {
  combo: LibraryCombo;
  catalog: Movement[];
  recentMovementIds: string[];
}

const GENERATION_VERSION = 1;

const llmWorkoutSchema = z.object({
  exercises: z
    .array(
      z.object({
        movementId: z.string(),
        sets: z.number(),
        reps: z.number().optional(),
        duration: z.number().optional().describe("Seconds, for duration-based exercises"),
      }),
    )
    .describe("Exercise prescriptions in workout order with VARIED sets/reps"),
  description: z.string().describe("2-3 sentence workout description for the page"),
  metaDescription: z.string().describe("SEO meta description under 155 characters"),
  restGuidance: z
    .string()
    .describe(
      "Brief rest period guidance, e.g. 'Rest 90-120s between compound sets, 60s between isolation sets'",
    ),
});

function preFilterCatalog(catalog: Movement[], combo: LibraryCombo): Movement[] {
  let filtered = catalog;

  if (combo.equipmentConfig === "bodyweight_only") {
    filtered = filtered.filter((m) => m.inFreeLift === true);
  } else {
    filtered = filtered.filter((m) => m.onMachine);
  }

  if (combo.sessionType === "mobility") {
    filtered = filtered.filter((m) =>
      m.trainingTypes?.some((t) => MOBILITY_TRAINING_TYPES.includes(t)),
    );
  } else if (combo.sessionType === "recovery") {
    filtered = filtered.filter((m) =>
      m.trainingTypes?.some((t) => RECOVERY_TRAINING_TYPES.includes(t)),
    );
  }

  const excludedAccessories = getExcludedAccessoriesForConfig(combo.equipmentConfig);
  if (excludedAccessories.length > 0) {
    const excludeSet = new Set(excludedAccessories);
    filtered = filtered.filter(
      (m) => !m.onMachineInfo?.accessory || !excludeSet.has(m.onMachineInfo.accessory),
    );
  }

  return filtered;
}

function formatCatalogForPrompt(catalog: Movement[]): string {
  return catalog
    .map((m) => {
      const accessory = m.onMachineInfo?.accessory ?? "bodyweight";
      const type = m.countReps ? "reps" : "duration";
      return `${m.id} | ${m.name} | ${m.muscleGroups.join(", ")} | ${accessory} | ${type} | skill:${m.skillLevel}`;
    })
    .join("\n");
}

/**
 * LLM-driven workout builder. Asks Gemini to design the workout given the
 * filtered movement catalog and combo parameters. Returns null if the LLM
 * can't produce a valid workout or fewer than 3 exercises are available.
 */
export async function buildLibraryWorkout(
  input: BuildLibraryWorkoutInput,
): Promise<LibraryWorkoutData | null> {
  const { combo, catalog, recentMovementIds } = input;
  const { sessionType, goal, durationMinutes, level, equipmentConfig } = combo;

  const filteredCatalog = preFilterCatalog(catalog, combo);
  if (filteredCatalog.length < 3) return null;

  const targetMuscles = SESSION_TYPE_MUSCLES[sessionType] ?? [];
  const maxExercises = getMaxExercises(durationMinutes);
  const scheme = getRepSetScheme(goal);
  const sessionLabel = getSessionTypeLabel(sessionType);
  const goalLabel = getGoalLabel(goal);

  const recentNote =
    recentMovementIds.length > 0
      ? `\nAvoid these recently used movement IDs if possible (for variety): ${recentMovementIds.slice(0, 20).join(", ")}`
      : "";

  const levelGuidance = {
    beginner:
      "Use moderate reps (10-15) with controlled tempo. Prioritize simple compound movements. Avoid complex unilateral or stability-demanding exercises.",
    intermediate:
      "Mix rep ranges: compounds at 8-10 reps, accessories at 10-12, finishers at 12-15. Include some unilateral work.",
    advanced:
      "Vary rep ranges significantly: heavy compounds at 4-6 reps with more sets, moderate accessories at 8-10, burnout/isolation finishers at 12-15. Include advanced movements and challenging variations.",
  }[level];

  const goalRepGuidance = {
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
  }[goal];

  const prompt = `You are an expert strength coach designing a Tonal workout for a real person. This must look like it was programmed by a knowledgeable coach, not auto-generated.

WORKOUT PARAMETERS:
- Session: ${sessionLabel} (target muscles: ${targetMuscles.join(", ")})
- Goal: ${goalLabel}
- Duration: ${durationMinutes} minutes (select ${maxExercises} exercises max)
- Level: ${level}
- Equipment: ${equipmentConfig.replace(/_/g, " ")}

REP SCHEME GUIDANCE (CRITICAL - DO NOT USE IDENTICAL REPS ON EVERY EXERCISE):
${goalRepGuidance}
${levelGuidance}
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

CONTENT RULES:
- Write a description (2-3 sentences) that sells the workout. What it targets, why the exercise selection matters, who it's for. Write in second person ("you"). No em dashes. Be specific about the training approach.
- Write a metaDescription under 155 characters for SEO. Include "Tonal workout" and the key attributes.

AVAILABLE EXERCISES:
id | name | muscles | accessory | type | skill
${formatCatalogForPrompt(filteredCatalog)}`;

  try {
    const { output } = await generateText({
      model: google("gemini-3-flash-preview"),
      output: Output.object({ schema: llmWorkoutSchema }),
      prompt,
    });

    if (!output || output.exercises.length < 3) return null;

    // Validate all movement IDs exist in catalog
    const catalogById = new Map(filteredCatalog.map((m) => [m.id, m]));
    const validExercises = output.exercises.filter((e) => catalogById.has(e.movementId));
    if (validExercises.length < 3) return null;

    // Build movement details from LLM selections
    const movementDetails: MovementDetail[] = validExercises.map((e) => {
      const mov = catalogById.get(e.movementId)!;
      return {
        movementId: e.movementId,
        name: mov.name,
        shortName: mov.shortName,
        muscleGroups: mov.muscleGroups,
        sets: e.sets,
        reps: e.reps,
        duration: e.duration,
        phase: "main" as const,
        thumbnailMediaUrl: mov.thumbnailMediaUrl,
        accessory: mov.onMachineInfo?.accessory,
      };
    });

    // Build blocks from the LLM-ordered movement IDs
    const orderedIds = validExercises.map((e) => e.movementId);
    const sortedIds = sortForMinimalEquipmentSwitches(orderedIds, filteredCatalog);
    const blocks = blocksFromMovementIds(sortedIds, undefined, { catalog: filteredCatalog });

    // Derive metadata
    const allMuscleGroups = [...new Set(movementDetails.flatMap((m) => m.muscleGroups))];
    const totalSets = movementDetails.reduce((sum, m) => sum + m.sets, 0);
    const equipmentNeeded = [
      ...new Set(movementDetails.map((m) => m.accessory).filter((a): a is string => a != null)),
    ];

    const slug = generateSlug(combo);
    const title = generateTitle(combo);
    const metaTitle = generateMetaTitle(title);

    return {
      slug,
      title,
      description: output.description,
      sessionType,
      goal,
      durationMinutes,
      level,
      equipmentConfig,
      blocks,
      movementDetails,
      targetMuscleGroups: targetMuscles.length > 0 ? targetMuscles : allMuscleGroups,
      exerciseCount: movementDetails.length,
      totalSets,
      equipmentNeeded,
      metaTitle,
      metaDescription: output.metaDescription,
      restGuidance: output.restGuidance,
      generationVersion: GENERATION_VERSION,
      createdAt: Date.now(),
    };
  } catch (e) {
    console.error(
      `LLM generation failed for ${sessionType}-${goal}-${durationMinutes}-${level}:`,
      e,
    );
    return null;
  }
}
