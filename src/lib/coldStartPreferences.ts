/** Cold-start preference constants shared by onboarding field components. */

export const GOAL_OPTIONS = [
  { value: "build_muscle", label: "Build muscle" },
  { value: "get_stronger", label: "Get stronger" },
  { value: "lose_fat", label: "Lose fat / recomp" },
  { value: "general_fitness", label: "General fitness" },
] as const;

export const DAYS_PER_WEEK_OPTIONS = [2, 3, 4, 5] as const;
