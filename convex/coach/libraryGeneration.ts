import {
  generateMetaTitle,
  generateSlug,
  generateTitle,
  getExcludedAccessoriesForConfig,
  getMaxExercises,
  getRepSetScheme,
} from "./goalConfig";
import type {
  LibraryDuration,
  LibraryEquipmentConfig,
  LibraryGoal,
  LibraryLevel,
  LibrarySessionType,
} from "./goalConfig";
import { selectExercises } from "./exerciseSelection";
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

  // Rule 1: bodyweight_only only valid for certain sessions
  if (
    equipmentConfig === "bodyweight_only" &&
    !["full_body", "core", "legs", "glutes_hamstrings", "mobility", "recovery"].includes(
      sessionType,
    )
  ) {
    return false;
  }

  // Rule 2: endurance not valid for 60min
  if (goal === "endurance" && durationMinutes === 60) return false;

  // Rule 3: strength and power not valid for beginner
  if ((goal === "strength" || goal === "power") && level === "beginner") return false;

  // Rule 4: power not valid for 20min
  if (goal === "power" && durationMinutes === 20) return false;

  // Rule 5: mobility/recovery sessions only with mobility_flexibility or functional goals
  if (
    (sessionType === "mobility" || sessionType === "recovery") &&
    goal !== "mobility_flexibility" &&
    goal !== "functional"
  ) {
    return false;
  }

  // Rule 6: sport_complement only with certain sessions
  if (
    goal === "sport_complement" &&
    !["full_body", "upper", "lower", "legs", "glutes_hamstrings", "core"].includes(sessionType)
  ) {
    return false;
  }

  // Rule 7: mobility_flexibility only with certain sessions
  if (
    goal === "mobility_flexibility" &&
    !["full_body", "mobility", "recovery", "core"].includes(sessionType)
  ) {
    return false;
  }

  // Rule 8: 20min full_body + strength not enough time
  if (durationMinutes === 20 && sessionType === "full_body" && goal === "strength") return false;

  return true;
}

function collectEquipmentVariants(
  sessionType: LibrarySessionType,
  goal: LibraryGoal,
  durationMinutes: LibraryDuration,
  level: LibraryLevel,
): LibraryCombo[] {
  return ALL_EQUIPMENT.flatMap((equipmentConfig) => {
    const combo: LibraryCombo = { sessionType, goal, durationMinutes, level, equipmentConfig };
    return isValidCombo(combo) ? [combo] : [];
  });
}

export function enumerateValidCombos(): LibraryCombo[] {
  const combos: LibraryCombo[] = [];

  for (const sessionType of ALL_SESSION_TYPES) {
    for (const goal of ALL_GOALS) {
      for (const durationMinutes of ALL_DURATIONS) {
        for (const level of ALL_LEVELS) {
          combos.push(...collectEquipmentVariants(sessionType, goal, durationMinutes, level));
        }
      }
    }
  }

  return combos;
}

// ---------------------------------------------------------------------------
// Workout builder
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
  generationVersion: number;
  createdAt: number;
}

export interface BuildLibraryWorkoutInput {
  combo: LibraryCombo;
  catalog: Movement[];
  recentMovementIds: string[];
}

const GENERATION_VERSION = 1;

function mapLevelToNumber(level: LibraryLevel): number {
  if (level === "beginner") return 1;
  if (level === "intermediate") return 2;
  return 3;
}

/**
 * Pure function: given a combo + movement catalog, build a complete library workout.
 * Returns null if fewer than 3 exercises are available for the combo.
 */
export function buildLibraryWorkout(input: BuildLibraryWorkoutInput): LibraryWorkoutData | null {
  const { combo, catalog, recentMovementIds } = input;
  const { sessionType, goal, durationMinutes, level, equipmentConfig } = combo;

  // Pre-filter catalog based on session and equipment constraints
  let filteredCatalog = catalog;

  if (equipmentConfig === "bodyweight_only") {
    filteredCatalog = filteredCatalog.filter((m) => m.inFreeLift === true);
  } else {
    // For machine-based configs, only include on-machine exercises.
    // Without this, bodyweight exercises leak into handles/bar workouts.
    filteredCatalog = filteredCatalog.filter((m) => m.onMachine);
  }

  if (sessionType === "mobility") {
    const allowedTypes = new Set(MOBILITY_TRAINING_TYPES.map((t) => t.toLowerCase()));
    filteredCatalog = filteredCatalog.filter((m) =>
      m.trainingTypes?.some((t) => allowedTypes.has(t.toLowerCase())),
    );
  } else if (sessionType === "recovery") {
    const allowedTypes = new Set(RECOVERY_TRAINING_TYPES.map((t) => t.toLowerCase()));
    filteredCatalog = filteredCatalog.filter((m) =>
      m.trainingTypes?.some((t) => allowedTypes.has(t.toLowerCase())),
    );
  }

  const targetMuscleGroups = SESSION_TYPE_MUSCLES[sessionType] ?? [];
  const userLevel = mapLevelToNumber(level);
  const maxExercises = getMaxExercises(durationMinutes);
  const excludedAccessories = getExcludedAccessoriesForConfig(equipmentConfig);

  const selectedIds = selectExercises({
    catalog: filteredCatalog,
    targetMuscleGroups,
    userLevel,
    maxExercises,
    lastUsedMovementIds: [],
    constraints: {
      excludeAccessories: excludedAccessories,
    },
    recentWeeksMovementIds: recentMovementIds,
  });

  if (selectedIds.length < 3) return null;

  const sortedIds = sortForMinimalEquipmentSwitches(selectedIds, filteredCatalog);
  const blocks = blocksFromMovementIds(sortedIds, undefined, { catalog: filteredCatalog });

  const scheme = getRepSetScheme(goal);
  const catalogById = new Map(catalog.map((m) => [m.id, m]));

  const movementDetails: MovementDetail[] = sortedIds.map((id) => {
    const movement = catalogById.get(id);
    const detail: MovementDetail = {
      movementId: id,
      name: movement?.name ?? id,
      shortName: movement?.shortName ?? id,
      muscleGroups: movement?.muscleGroups ?? [],
      sets: scheme.sets,
      phase: "main",
      thumbnailMediaUrl: movement?.thumbnailMediaUrl,
      accessory: movement?.onMachineInfo?.accessory,
    };
    if (scheme.duration !== undefined) {
      detail.duration = scheme.duration;
    } else {
      detail.reps = scheme.reps;
    }
    return detail;
  });

  // Derived metadata
  const muscleGroupSet = new Set<string>();
  for (const detail of movementDetails) {
    for (const g of detail.muscleGroups) {
      muscleGroupSet.add(g);
    }
  }
  const derivedTargetMuscleGroups = Array.from(muscleGroupSet);

  const exerciseCount = movementDetails.length;
  const totalSets = movementDetails.reduce((sum, d) => sum + d.sets, 0);

  const accessorySet = new Set<string>();
  for (const detail of movementDetails) {
    if (detail.accessory) accessorySet.add(detail.accessory);
  }
  const equipmentNeeded = Array.from(accessorySet);

  const slug = generateSlug(combo);
  const title = generateTitle(combo);
  const metaTitle = generateMetaTitle(title);

  return {
    slug,
    title,
    description: "",
    sessionType,
    goal,
    durationMinutes,
    level,
    equipmentConfig,
    blocks,
    movementDetails,
    targetMuscleGroups: derivedTargetMuscleGroups,
    exerciseCount,
    totalSets,
    equipmentNeeded,
    metaTitle,
    metaDescription: "",
    generationVersion: GENERATION_VERSION,
    createdAt: Date.now(),
  };
}
