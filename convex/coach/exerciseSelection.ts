/**
 * Exercise selection engine for weekly programming.
 *
 * Pure logic: given a catalog, target muscles, user level, duration cap,
 * last-used exercises, and optional constraints, returns an ordered list of
 * movement IDs (compound first, then isolation), respecting no-repeat and
 * difficulty. No Convex or Tonal calls — caller supplies the catalog.
 *
 * @module convex/coach/exerciseSelection
 */

import type { Movement } from "../tonal/types";

/** Maximum skill level delta above user level we still include (e.g. 1 = allow one step harder). */
const MAX_SKILL_LEVEL_DELTA = 1;

export interface ExerciseSelectionInput {
  /** Full movement catalog (e.g. from Tonal cache or hardware adapter). */
  catalog: Movement[];
  /** Target muscle groups for this session (e.g. ["Chest", "Triceps", "Shoulders"] for push). */
  targetMuscleGroups: string[];
  /** User's max comfortable skill level (1-based). Movements with skillLevel <= userLevel + 1 are included. */
  userLevel: number;
  /** Max number of exercises to return (duration cap; caller derives from session minutes). */
  maxExercises: number;
  /** Movement IDs used in the last session for this muscle group — excluded to avoid repeat. */
  lastUsedMovementIds: string[];
  /** Optional constraints. */
  constraints?: {
    /** Exclude movements whose name contains any of these substrings (case-insensitive). E.g. ["Overhead"] for no overhead pressing. */
    excludeNameSubstrings?: string[];
  };
}

/**
 * Returns movement IDs that match target muscles and are not in the exclude set.
 * Compound = targets 2+ of the requested muscle groups; isolation = 1.
 * Order: compounds first (by most target groups, then by skill-level fit), then isolations.
 *
 * **How the weekly programming engine calls this:**
 * 1. Load catalog: from Convex cache (movements) or hardware adapter getExercises().
 * 2. For each session day, get target muscle groups from the session type (e.g. push → Chest, Triceps, Shoulders).
 * 3. Get last-used movement IDs for that muscle group from the previous week or last same-split session.
 * 4. Derive maxExercises from session duration (e.g. 30 min → 5, 45 → 7, 60 → 9).
 * 5. Call selectExercises({ catalog, targetMuscleGroups, userLevel, maxExercises, lastUsedMovementIds, constraints }).
 * 6. Use returned movement IDs to build workout blocks (volume/intensity applied elsewhere).
 *
 * @param input - Catalog, target muscles, user level, duration cap, last-used IDs, optional constraints.
 * @returns Ordered list of movement IDs (compound first, then isolation), length <= maxExercises. Returns empty list if catalog is empty or all candidates are excluded; caller should ensure catalog is loaded before calling.
 */
export function selectExercises(input: ExerciseSelectionInput): string[] {
  const { catalog, targetMuscleGroups, userLevel, maxExercises, lastUsedMovementIds, constraints } =
    input;

  const targetSet = new Set(targetMuscleGroups.map((g) => g.toLowerCase()));
  const lastUsedSet = new Set(lastUsedMovementIds);
  const excludeSubstrings = (constraints?.excludeNameSubstrings ?? []).map((s) => s.toLowerCase());

  const eligible = catalog.filter((m) => {
    if (lastUsedSet.has(m.id)) return false;
    const matchesTarget = m.muscleGroups.some((g) => targetSet.has(g.toLowerCase()));
    if (!matchesTarget) return false;
    if (excludeSubstrings.length) {
      const nameLower = m.name.toLowerCase();
      if (excludeSubstrings.some((sub) => nameLower.includes(sub))) return false;
    }
    if (m.skillLevel > userLevel + MAX_SKILL_LEVEL_DELTA) return false;
    return true;
  });

  const targetGroupCount = (m: Movement): number =>
    m.muscleGroups.filter((g) => targetSet.has(g.toLowerCase())).length;

  const isCompound = (m: Movement): boolean => targetGroupCount(m) >= 2;
  const skillDelta = (m: Movement): number => Math.abs(m.skillLevel - userLevel);

  const compounds = eligible.filter(isCompound).sort((a, b) => {
    const c = targetGroupCount(b) - targetGroupCount(a);
    if (c !== 0) return c;
    return skillDelta(a) - skillDelta(b);
  });
  const isolations = eligible
    .filter((m) => !isCompound(m))
    .sort((a, b) => {
      const c = targetGroupCount(b) - targetGroupCount(a);
      if (c !== 0) return c;
      return skillDelta(a) - skillDelta(b);
    });

  const ordered = [...compounds, ...isolations];
  return ordered.slice(0, maxExercises).map((m) => m.id);
}
