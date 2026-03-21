export type LibraryGoal =
  | "build_muscle"
  | "fat_loss"
  | "strength"
  | "endurance"
  | "athletic"
  | "general_fitness"
  | "power"
  | "functional"
  | "mobility_flexibility"
  | "sport_complement";

export type LibrarySessionType =
  | "push"
  | "pull"
  | "legs"
  | "upper"
  | "lower"
  | "full_body"
  | "chest"
  | "back"
  | "shoulders"
  | "arms"
  | "core"
  | "glutes_hamstrings"
  | "chest_back"
  | "mobility"
  | "recovery";

export type LibraryLevel = "beginner" | "intermediate" | "advanced";
export type LibraryDuration = 20 | 30 | 45 | 60;
export type LibraryEquipmentConfig =
  | "handles_only"
  | "handles_bar"
  | "full_accessories"
  | "bodyweight_only";

export interface RepSetScheme {
  sets: number;
  reps?: number;
  duration?: number;
}

const REP_SET_SCHEMES: Record<LibraryGoal, RepSetScheme> = {
  strength: { sets: 4, reps: 5 },
  build_muscle: { sets: 3, reps: 10 },
  fat_loss: { sets: 3, reps: 12 },
  endurance: { sets: 3, reps: 15 },
  athletic: { sets: 3, reps: 8 },
  general_fitness: { sets: 3, reps: 10 },
  power: { sets: 4, reps: 3 },
  functional: { sets: 3, reps: 12 },
  mobility_flexibility: { sets: 2, duration: 35 },
  sport_complement: { sets: 3, reps: 8 },
};

export function getRepSetScheme(goal: LibraryGoal): RepSetScheme {
  return REP_SET_SCHEMES[goal];
}

const DURATION_TO_MAX_EXERCISES: Record<LibraryDuration, number> = {
  20: 4,
  30: 6,
  45: 8,
  60: 10,
};

export function getMaxExercises(duration: LibraryDuration): number {
  return DURATION_TO_MAX_EXERCISES[duration];
}

export function getExcludedAccessoriesForConfig(config: LibraryEquipmentConfig): string[] {
  // Tonal API uses multiple names for the same equipment (see ACCESSORY_MAP in accessories.ts).
  // All variant names must be listed to fully exclude an accessory type.
  switch (config) {
    case "handles_only":
      return [
        "Smart Bar",
        "StraightBar",
        "Bar", // bar variants
        "Rope", // rope
        "Roller", // roller
        "Weight Bar",
        "Barbell", // weight bar variants
        "Pilates Loops",
        "PilatesLoops", // pilates loops
        "AnkleStraps", // ankle straps
      ];
    case "handles_bar":
      return [
        "Rope", // rope
        "Roller", // roller
        "Pilates Loops",
        "PilatesLoops", // pilates loops
        "AnkleStraps", // ankle straps
      ];
    case "full_accessories":
      return [];
    case "bodyweight_only":
      return [];
  }
}

const GOAL_LABELS: Record<LibraryGoal, string> = {
  build_muscle: "Hypertrophy",
  fat_loss: "Fat Loss",
  strength: "Strength",
  endurance: "Endurance",
  athletic: "Athletic",
  general_fitness: "General Fitness",
  power: "Power",
  functional: "Functional",
  mobility_flexibility: "Mobility",
  sport_complement: "Sport Complement",
};

export function getGoalLabel(goal: LibraryGoal): string {
  return GOAL_LABELS[goal];
}

const SESSION_TYPE_LABELS: Record<LibrarySessionType, string> = {
  push: "Push",
  pull: "Pull",
  legs: "Legs",
  upper: "Upper Body",
  lower: "Lower Body",
  full_body: "Full Body",
  chest: "Chest",
  back: "Back",
  shoulders: "Shoulders",
  arms: "Arms",
  core: "Core",
  glutes_hamstrings: "Glutes & Hamstrings",
  chest_back: "Chest & Back",
  mobility: "Mobility",
  recovery: "Recovery",
};

export function getSessionTypeLabel(sessionType: LibrarySessionType): string {
  return SESSION_TYPE_LABELS[sessionType];
}

export interface ComboInput {
  sessionType: LibrarySessionType;
  goal: LibraryGoal;
  durationMinutes: LibraryDuration;
  level: LibraryLevel;
  equipmentConfig?: LibraryEquipmentConfig;
}

function toSlugPart(value: string): string {
  return value.replace(/_/g, "-");
}

export function generateSlug(combo: Required<ComboInput>): string {
  return [
    toSlugPart(combo.sessionType),
    toSlugPart(combo.goal),
    `${combo.durationMinutes}min`,
    toSlugPart(combo.level),
    toSlugPart(combo.equipmentConfig),
  ].join("-");
}

export function generateTitle(
  combo: Pick<ComboInput, "sessionType" | "goal" | "durationMinutes" | "level">,
): string {
  const sessionLabel = getSessionTypeLabel(combo.sessionType);
  const goalLabel = getGoalLabel(combo.goal);
  const level = combo.level.charAt(0).toUpperCase() + combo.level.slice(1);
  return `${sessionLabel} ${goalLabel} Workout - ${combo.durationMinutes}min ${level}`;
}

export function generateMetaTitle(title: string): string {
  return `${title} | Free Tonal Workout`;
}

const GOAL_DESCRIPTIONS: Record<LibraryGoal, string> = {
  build_muscle: "maximize muscle growth with hypertrophy-focused rep ranges",
  fat_loss: "burn calories and build lean muscle with high-rep supersets",
  strength: "build raw strength with heavy, low-rep compound movements",
  endurance: "improve muscular endurance with high-rep, low-rest training",
  athletic: "develop balanced power and coordination for athletic performance",
  general_fitness: "build a solid fitness foundation with balanced training",
  power: "develop explosive force with max-effort, low-rep movements",
  functional: "strengthen real-world movement patterns for daily life",
  mobility_flexibility: "improve range of motion and joint health",
  sport_complement: "reduce injury risk and improve performance for endurance athletes",
};

export function generateDescription(
  combo: Pick<ComboInput, "sessionType" | "goal" | "durationMinutes" | "level">,
  exerciseCount: number,
  targetMuscleGroups: string[],
): string {
  const sessionLabel = getSessionTypeLabel(combo.sessionType).toLowerCase();
  const muscles = targetMuscleGroups.slice(0, 3).join(", ").toLowerCase();
  const goalDesc = GOAL_DESCRIPTIONS[combo.goal];

  return (
    `This ${combo.durationMinutes}-minute ${sessionLabel} workout targets ${muscles} ` +
    `with ${exerciseCount} exercises designed to ${goalDesc}. ` +
    `Built for ${combo.level} lifters using the Tonal home gym.`
  );
}

export function generateMetaDescription(
  combo: Pick<ComboInput, "sessionType" | "goal" | "durationMinutes" | "level">,
  exerciseCount: number,
): string {
  const sessionLabel = getSessionTypeLabel(combo.sessionType);
  const goalLabel = getGoalLabel(combo.goal);
  return (
    `Free ${combo.durationMinutes}min ${sessionLabel.toLowerCase()} ${goalLabel.toLowerCase()} ` +
    `Tonal workout for ${combo.level} lifters. ${exerciseCount} exercises. Open directly in your Tonal app.`
  );
}
