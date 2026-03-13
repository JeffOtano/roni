/**
 * Cold-start preference flow: goals, days/week, injuries.
 * Stored in localStorage (frontend only; no new Convex mutations per spec).
 */

const STORAGE_KEY = "tonal-coach-cold-start-preferences";

export interface ColdStartPreferences {
  goal: string;
  daysPerWeek: number;
  injuriesOrConstraints: string;
  completedAt: number;
}

export function getStoredColdStartPreferences(): ColdStartPreferences | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ColdStartPreferences;
    if (
      typeof parsed.goal === "string" &&
      typeof parsed.daysPerWeek === "number" &&
      typeof parsed.injuriesOrConstraints === "string" &&
      typeof parsed.completedAt === "number"
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function setStoredColdStartPreferences(prefs: ColdStartPreferences): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

export const GOAL_OPTIONS = [
  { value: "build_muscle", label: "Build muscle" },
  { value: "get_stronger", label: "Get stronger" },
  { value: "lose_fat", label: "Lose fat / recomp" },
  { value: "general_fitness", label: "General fitness" },
] as const;

export const DAYS_PER_WEEK_OPTIONS = [2, 3, 4, 5] as const;
