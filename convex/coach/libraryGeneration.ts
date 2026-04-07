import { generateText, Output } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import {
  generateMetaTitle,
  generateSlug,
  generateTitle,
  getExcludedAccessoriesForConfig,
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
import { buildWorkoutPrompt, llmWorkoutSchema } from "./libraryPrompt";
import { withByokErrorSanitization } from "../ai/resilience";

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
  coachingCue?: string;
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
  workoutRationale?: string;
  whoIsThisFor?: string;
  faq?: Array<{ question: string; answer: string }>;
  generationVersion: number;
  createdAt: number;
}

export interface BuildLibraryWorkoutInput {
  combo: LibraryCombo;
  catalog: Movement[];
  recentMovementIds: string[];
  /**
   * Gemini API key used to bill the LLM call. The library generator is
   * operator-run (see scripts/generate-library.sh) and produces a shared
   * catalog of workouts that every user reads, so this is always the
   * house key. There is no user context to BYOK against. The caller is
   * responsible for sourcing the key from process.env.GOOGLE_GENERATIVE_AI_API_KEY.
   */
  apiKey: string;
}

const GENERATION_VERSION = 1;

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

export async function buildLibraryWorkout(
  input: BuildLibraryWorkoutInput,
): Promise<LibraryWorkoutData | null> {
  const { combo, catalog, recentMovementIds, apiKey } = input;
  const { sessionType, goal, durationMinutes, level, equipmentConfig } = combo;

  const filteredCatalog = preFilterCatalog(catalog, combo);
  if (filteredCatalog.length < 3) return null;

  const targetMuscles = SESSION_TYPE_MUSCLES[sessionType] ?? [];
  const prompt = buildWorkoutPrompt(combo, filteredCatalog, recentMovementIds);

  // Per-request provider so this code path never reads the ambient
  // GOOGLE_GENERATIVE_AI_API_KEY env var. The apiKey is supplied by the
  // operator-run caller (always the house key, since the library is shared
  // across all users and there is no per-user context here).
  const provider = createGoogleGenerativeAI({ apiKey });

  try {
    const { output } = await withByokErrorSanitization(() =>
      generateText({
        model: provider("gemini-3-flash-preview"),
        output: Output.object({ schema: llmWorkoutSchema }),
        prompt,
      }),
    );

    if (!output || output.exercises.length < 3) return null;

    const catalogById = new Map(filteredCatalog.map((m) => [m.id, m]));
    const validExercises = output.exercises.filter((e) => catalogById.has(e.movementId));
    if (validExercises.length < 3) return null;

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
        coachingCue: e.coachingCue,
      };
    });

    const orderedIds = validExercises.map((e) => e.movementId);
    const sortedIds = sortForMinimalEquipmentSwitches(orderedIds, filteredCatalog);
    const blocks = blocksFromMovementIds(sortedIds, undefined, { catalog: filteredCatalog });

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
      workoutRationale: output.workoutRationale,
      whoIsThisFor: output.whoIsThisFor,
      faq: output.faq,
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
