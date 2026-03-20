import type {
  LibraryDuration,
  LibraryEquipmentConfig,
  LibraryGoal,
  LibraryLevel,
  LibrarySessionType,
} from "./goalConfig";

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
