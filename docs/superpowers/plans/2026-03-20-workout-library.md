# Workout Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public workout library at `/workouts` with ~800-1,000 programmatically generated Tonal workouts, serving as both an SEO engine and conversion funnel.

**Architecture:** SSG + ISR static pages generated from a Convex `libraryWorkouts` table. A generation engine produces workouts by combining session types, goals, durations, levels, and equipment configs, reusing existing `selectExercises()` and `blocksFromMovementIds()` functions. LLM descriptions generated in a separate pass. Browse page uses client-side filtering of the full list.

**Tech Stack:** Convex (backend), Next.js 16 App Router (SSG/ISR), Tailwind CSS, shadcn/ui, Satori (OG images), Vitest (testing)

**Spec:** `docs/superpowers/specs/2026-03-20-workout-library-design.md`

---

## File Structure

### New Files

| File                                                   | Responsibility                                                         |
| ------------------------------------------------------ | ---------------------------------------------------------------------- |
| `convex/libraryWorkouts.ts`                            | Public queries: getBySlug, listAll, getSlugs, getRelated               |
| `convex/coach/libraryGeneration.ts`                    | Generation engine: combo enumeration, pruning, workout building        |
| `convex/coach/libraryGeneration.test.ts`               | Unit tests for generation logic (pure functions)                       |
| `convex/coach/goalConfig.ts`                           | Goal-based rep/set schemes, equipment config mappings, title templates |
| `convex/coach/goalConfig.test.ts`                      | Unit tests for goal config                                             |
| `src/app/workouts/layout.tsx`                          | Public layout wrapping SiteNav + SiteFooter                            |
| `src/app/workouts/page.tsx`                            | Browse page: SSG shell, client-side filtering                          |
| `src/app/workouts/[slug]/page.tsx`                     | Detail page: SSG + ISR, workout content                                |
| `src/app/workouts/[slug]/opengraph-image.tsx`          | Dynamic OG image via Satori                                            |
| `src/app/workouts/_components/WorkoutFilters.tsx`      | Filter pills (client component)                                        |
| `src/app/workouts/_components/WorkoutLibraryCard.tsx`  | Card for browse grid                                                   |
| `src/app/workouts/_components/WorkoutBlockDisplay.tsx` | Renders blocks with exercises                                          |
| `src/app/workouts/_components/WorkoutCtaBanner.tsx`    | CTA conversion section                                                 |
| `src/app/workouts/_components/RelatedWorkouts.tsx`     | Related workout cards                                                  |
| `src/app/workouts/_components/WorkoutJsonLd.tsx`       | ExercisePlan structured data                                           |

### Modified Files

| File                                           | Change                                               |
| ---------------------------------------------- | ---------------------------------------------------- |
| `convex/schema.ts`                             | Add libraryWorkouts table (after line 468)           |
| `convex/coach/weekProgrammingHelpers.ts:23-40` | Extend SESSION_TYPE_MUSCLES with new session types   |
| `convex/coach/weekProgrammingHelpers.ts:14-18` | Add 20min to SESSION_DURATION_TO_MAX_EXERCISES       |
| `src/app/(app)/workouts/`                      | Rename entire directory to `src/app/(app)/activity/` |
| `src/app/robots.ts:3-19`                       | Change "/workouts" to "/activity" in APP_ROUTES      |
| `src/app/sitemap.ts:5-48`                      | Add workout slugs from Convex query                  |
| `src/app/page.tsx:169`                         | Add "Browse Workouts" section before PricingTeaser   |
| `src/app/_components/SiteNav.tsx:4-9`          | Add "Workouts" to NAV_LINKS                          |
| `src/app/_components/SiteFooter.tsx:3-7`       | Add "Workout Library" to PRODUCT_LINKS               |

---

## Task 1: Goal Config and Equipment Mapping

**Files:**

- Create: `convex/coach/goalConfig.ts`
- Create: `convex/coach/goalConfig.test.ts`

Pure functions with zero dependencies. Foundation for everything else.

- [ ] **Step 1: Write failing tests for goal config**

```typescript
// convex/coach/goalConfig.test.ts
import { describe, expect, it } from "vitest";
import {
  getRepSetScheme,
  getExcludedAccessoriesForConfig,
  getMaxExercises,
  getGoalLabel,
  generateSlug,
  generateTitle,
} from "./goalConfig";

describe("getRepSetScheme", () => {
  it("returns hypertrophy scheme for build_muscle", () => {
    const scheme = getRepSetScheme("build_muscle");
    expect(scheme).toEqual({ sets: 3, reps: 10 });
  });

  it("returns duration-based scheme for mobility_flexibility", () => {
    const scheme = getRepSetScheme("mobility_flexibility");
    expect(scheme).toEqual({ sets: 2, duration: 35 });
  });

  it("returns power scheme with low reps", () => {
    const scheme = getRepSetScheme("power");
    expect(scheme).toEqual({ sets: 4, reps: 3 });
  });
});

describe("getExcludedAccessoriesForConfig", () => {
  it("excludes bar, rope, roller for handles_only", () => {
    const excluded = getExcludedAccessoriesForConfig("handles_only");
    expect(excluded).toContain("Smart Bar");
    expect(excluded).toContain("Rope");
    expect(excluded).toContain("Roller");
    expect(excluded).toContain("Weight Bar");
  });

  it("returns empty array for full_accessories", () => {
    expect(getExcludedAccessoriesForConfig("full_accessories")).toEqual([]);
  });

  it("returns empty array for bodyweight_only", () => {
    expect(getExcludedAccessoriesForConfig("bodyweight_only")).toEqual([]);
  });
});

describe("getMaxExercises", () => {
  it("returns 4 for 20min", () => {
    expect(getMaxExercises(20)).toBe(4);
  });

  it("returns 10 for 60min", () => {
    expect(getMaxExercises(60)).toBe(10);
  });
});

describe("getGoalLabel", () => {
  it("maps build_muscle to Hypertrophy", () => {
    expect(getGoalLabel("build_muscle")).toBe("Hypertrophy");
  });

  it("maps mobility_flexibility to Mobility", () => {
    expect(getGoalLabel("mobility_flexibility")).toBe("Mobility");
  });
});

describe("generateSlug", () => {
  it("produces correct slug format", () => {
    const slug = generateSlug({
      sessionType: "push",
      goal: "build_muscle",
      durationMinutes: 45,
      level: "intermediate",
      equipmentConfig: "handles_bar",
    });
    expect(slug).toBe("push-build-muscle-45min-intermediate-handles-bar");
  });
});

describe("generateTitle", () => {
  it("produces human-readable title", () => {
    const title = generateTitle({
      sessionType: "push",
      goal: "build_muscle",
      durationMinutes: 45,
      level: "intermediate",
    });
    expect(title).toBe("Push Hypertrophy Workout - 45min Intermediate");
  });

  it("handles multi-word session types", () => {
    const title = generateTitle({
      sessionType: "glutes_hamstrings",
      goal: "sport_complement",
      durationMinutes: 30,
      level: "beginner",
    });
    expect(title).toBe("Glutes & Hamstrings Sport Complement Workout - 30min Beginner");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run convex/coach/goalConfig.test.ts`
Expected: FAIL - module not found

- [ ] **Step 3: Implement goalConfig.ts**

```typescript
// convex/coach/goalConfig.ts

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
  duration?: number; // seconds, for mobility/flexibility
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
  switch (config) {
    case "handles_only":
      return ["Smart Bar", "Rope", "Roller", "Weight Bar"];
    case "handles_bar":
      return ["Rope", "Roller"];
    case "full_accessories":
      return [];
    case "bodyweight_only":
      return []; // handled by inFreeLift pre-filter
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

export function generateSlug(combo: Required<ComboInput>): string {
  return `${combo.sessionType}-${combo.goal}-${combo.durationMinutes}min-${combo.level}-${combo.equipmentConfig}`;
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run convex/coach/goalConfig.test.ts`
Expected: All PASS

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add convex/coach/goalConfig.ts convex/coach/goalConfig.test.ts
git commit -m "feat: add goal config and equipment mapping for workout library"
```

---

## Task 2: Extend Session Type Muscles and Duration Mappings

**Files:**

- Modify: `convex/coach/weekProgrammingHelpers.ts:14-18` (SESSION_DURATION_TO_MAX_EXERCISES)
- Modify: `convex/coach/weekProgrammingHelpers.ts:23-40` (SESSION_TYPE_MUSCLES)

- [ ] **Step 1: Add 20min to SESSION_DURATION_TO_MAX_EXERCISES**

At `convex/coach/weekProgrammingHelpers.ts:14-18`, add the 20-minute entry:

```typescript
export const SESSION_DURATION_TO_MAX_EXERCISES: Record<number, number> = {
  20: 4,
  30: 6,
  45: 8,
  60: 10,
};
```

- [ ] **Step 2: Extend SESSION_TYPE_MUSCLES with new session types**

At `convex/coach/weekProgrammingHelpers.ts:23-40`, add new entries after the existing ones:

```typescript
// Add after existing entries:
chest: ["Chest", "Triceps"],
back: ["Back", "Biceps"],
shoulders: ["Shoulders", "Triceps"],
arms: ["Biceps", "Triceps"],
core: ["Core", "Obliques"],
glutes_hamstrings: ["Glutes", "Hamstrings"],
chest_back: ["Chest", "Back"],
mobility: [],
recovery: [],
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Run existing tests to confirm no regressions**

Run: `npx vitest run convex/coach/`
Expected: All existing tests pass

- [ ] **Step 5: Commit**

```bash
git add convex/coach/weekProgrammingHelpers.ts
git commit -m "feat: extend session types and durations for workout library"
```

---

## Task 3: Combination Enumeration and Pruning

**Files:**

- Create: `convex/coach/libraryGeneration.ts`
- Create: `convex/coach/libraryGeneration.test.ts`

Pure functions only in this task. No Convex queries/actions yet.

- [ ] **Step 1: Write failing tests for combo enumeration and pruning**

```typescript
// convex/coach/libraryGeneration.test.ts
import { describe, expect, it } from "vitest";
import { enumerateValidCombos, isValidCombo, type LibraryCombo } from "./libraryGeneration";

describe("isValidCombo", () => {
  it("rejects bodyweight_only with chest session", () => {
    expect(
      isValidCombo({
        sessionType: "chest",
        goal: "build_muscle",
        durationMinutes: 30,
        level: "intermediate",
        equipmentConfig: "bodyweight_only",
      }),
    ).toBe(false);
  });

  it("allows bodyweight_only with full_body", () => {
    expect(
      isValidCombo({
        sessionType: "full_body",
        goal: "general_fitness",
        durationMinutes: 30,
        level: "beginner",
        equipmentConfig: "bodyweight_only",
      }),
    ).toBe(true);
  });

  it("rejects endurance goal with 60min duration", () => {
    expect(
      isValidCombo({
        sessionType: "push",
        goal: "endurance",
        durationMinutes: 60,
        level: "intermediate",
        equipmentConfig: "handles_only",
      }),
    ).toBe(false);
  });

  it("rejects strength goal for beginner", () => {
    expect(
      isValidCombo({
        sessionType: "upper",
        goal: "strength",
        durationMinutes: 45,
        level: "beginner",
        equipmentConfig: "handles_bar",
      }),
    ).toBe(false);
  });

  it("rejects power goal for beginner", () => {
    expect(
      isValidCombo({
        sessionType: "push",
        goal: "power",
        durationMinutes: 45,
        level: "beginner",
        equipmentConfig: "full_accessories",
      }),
    ).toBe(false);
  });

  it("rejects power goal for 20min", () => {
    expect(
      isValidCombo({
        sessionType: "upper",
        goal: "power",
        durationMinutes: 20,
        level: "advanced",
        equipmentConfig: "handles_bar",
      }),
    ).toBe(false);
  });

  it("rejects mobility session with build_muscle goal", () => {
    expect(
      isValidCombo({
        sessionType: "mobility",
        goal: "build_muscle",
        durationMinutes: 30,
        level: "beginner",
        equipmentConfig: "bodyweight_only",
      }),
    ).toBe(false);
  });

  it("allows mobility session with mobility_flexibility goal", () => {
    expect(
      isValidCombo({
        sessionType: "mobility",
        goal: "mobility_flexibility",
        durationMinutes: 30,
        level: "beginner",
        equipmentConfig: "bodyweight_only",
      }),
    ).toBe(true);
  });

  it("rejects sport_complement with push session", () => {
    expect(
      isValidCombo({
        sessionType: "push",
        goal: "sport_complement",
        durationMinutes: 30,
        level: "intermediate",
        equipmentConfig: "handles_only",
      }),
    ).toBe(false);
  });

  it("allows sport_complement with full_body session", () => {
    expect(
      isValidCombo({
        sessionType: "full_body",
        goal: "sport_complement",
        durationMinutes: 30,
        level: "intermediate",
        equipmentConfig: "handles_only",
      }),
    ).toBe(true);
  });

  it("rejects mobility_flexibility with push session", () => {
    expect(
      isValidCombo({
        sessionType: "push",
        goal: "mobility_flexibility",
        durationMinutes: 30,
        level: "beginner",
        equipmentConfig: "handles_only",
      }),
    ).toBe(false);
  });

  it("rejects 20min full_body strength", () => {
    expect(
      isValidCombo({
        sessionType: "full_body",
        goal: "strength",
        durationMinutes: 20,
        level: "advanced",
        equipmentConfig: "full_accessories",
      }),
    ).toBe(false);
  });
});

describe("enumerateValidCombos", () => {
  it("produces combos within expected range", () => {
    const combos = enumerateValidCombos();
    expect(combos.length).toBeGreaterThan(500);
    expect(combos.length).toBeLessThan(1500);
  });

  it("produces no invalid combos", () => {
    const combos = enumerateValidCombos();
    for (const combo of combos) {
      expect(isValidCombo(combo)).toBe(true);
    }
  });

  it("produces unique slugs", () => {
    const combos = enumerateValidCombos();
    const slugs = combos.map(
      (c) => `${c.sessionType}-${c.goal}-${c.durationMinutes}-${c.level}-${c.equipmentConfig}`,
    );
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run convex/coach/libraryGeneration.test.ts`
Expected: FAIL - module not found

- [ ] **Step 3: Implement combo enumeration and pruning**

```typescript
// convex/coach/libraryGeneration.ts
import type {
  LibraryGoal,
  LibrarySessionType,
  LibraryLevel,
  LibraryDuration,
  LibraryEquipmentConfig,
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

const BODYWEIGHT_VALID_SESSIONS: LibrarySessionType[] = [
  "full_body",
  "core",
  "legs",
  "glutes_hamstrings",
  "mobility",
  "recovery",
];

const MOBILITY_RECOVERY_SESSIONS: LibrarySessionType[] = ["mobility", "recovery"];

const MOBILITY_RECOVERY_VALID_GOALS: LibraryGoal[] = ["mobility_flexibility", "functional"];

const SPORT_COMPLEMENT_VALID_SESSIONS: LibrarySessionType[] = [
  "full_body",
  "upper",
  "lower",
  "legs",
  "glutes_hamstrings",
  "core",
];

const MOBILITY_FLEXIBILITY_VALID_SESSIONS: LibrarySessionType[] = [
  "full_body",
  "mobility",
  "recovery",
  "core",
];

export function isValidCombo(combo: LibraryCombo): boolean {
  const { sessionType, goal, durationMinutes, level, equipmentConfig } = combo;

  // bodyweight_only limited to certain sessions
  if (equipmentConfig === "bodyweight_only" && !BODYWEIGHT_VALID_SESSIONS.includes(sessionType)) {
    return false;
  }

  // endurance not valid for 60min
  if (goal === "endurance" && durationMinutes === 60) return false;

  // strength and power not valid for beginner
  if ((goal === "strength" || goal === "power") && level === "beginner") {
    return false;
  }

  // power not valid for 20min
  if (goal === "power" && durationMinutes === 20) return false;

  // mobility/recovery sessions only with mobility_flexibility or functional
  if (
    MOBILITY_RECOVERY_SESSIONS.includes(sessionType) &&
    !MOBILITY_RECOVERY_VALID_GOALS.includes(goal)
  ) {
    return false;
  }

  // sport_complement only with certain sessions
  if (goal === "sport_complement" && !SPORT_COMPLEMENT_VALID_SESSIONS.includes(sessionType)) {
    return false;
  }

  // mobility_flexibility only with certain sessions
  if (
    goal === "mobility_flexibility" &&
    !MOBILITY_FLEXIBILITY_VALID_SESSIONS.includes(sessionType)
  ) {
    return false;
  }

  // 20min full_body + strength not enough time
  if (durationMinutes === 20 && sessionType === "full_body" && goal === "strength") {
    return false;
  }

  return true;
}

export function enumerateValidCombos(): LibraryCombo[] {
  const combos: LibraryCombo[] = [];
  for (const sessionType of ALL_SESSION_TYPES) {
    for (const goal of ALL_GOALS) {
      for (const durationMinutes of ALL_DURATIONS) {
        for (const level of ALL_LEVELS) {
          for (const equipmentConfig of ALL_EQUIPMENT) {
            const combo: LibraryCombo = {
              sessionType,
              goal,
              durationMinutes,
              level,
              equipmentConfig,
            };
            if (isValidCombo(combo)) {
              combos.push(combo);
            }
          }
        }
      }
    }
  }
  return combos;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run convex/coach/libraryGeneration.test.ts`
Expected: All PASS

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add convex/coach/libraryGeneration.ts convex/coach/libraryGeneration.test.ts
git commit -m "feat: add combo enumeration and pruning for workout library"
```

---

## Task 4: Workout Builder (Pure Function)

**Files:**

- Modify: `convex/coach/libraryGeneration.ts`
- Modify: `convex/coach/libraryGeneration.test.ts`

Add the pure function that takes a combo + movement catalog and produces a complete workout. No Convex calls - just transforms.

- [ ] **Step 1: Write failing tests for workout builder**

Add to `convex/coach/libraryGeneration.test.ts`:

```typescript
import {
  enumerateValidCombos,
  isValidCombo,
  buildLibraryWorkout,
  type LibraryCombo,
  type LibraryWorkoutData,
} from "./libraryGeneration";
import type { Movement } from "../tonal/types";

// Minimal test fixtures
function makeMovement(overrides: Partial<Movement> = {}): Movement {
  return {
    id: overrides.id ?? "mov-1",
    name: overrides.name ?? "Test Press",
    shortName: overrides.shortName ?? "T Press",
    muscleGroups: overrides.muscleGroups ?? ["Chest"],
    skillLevel: overrides.skillLevel ?? 1,
    publishState: "published",
    sortOrder: 1,
    onMachine: overrides.onMachine ?? true,
    inFreeLift: overrides.inFreeLift ?? false,
    countReps: overrides.countReps ?? true,
    isTwoSided: false,
    isBilateral: false,
    isAlternating: false,
    descriptionHow: "Push the weight",
    descriptionWhy: "Builds strength",
    thumbnailMediaUrl: overrides.thumbnailMediaUrl,
    onMachineInfo: overrides.onMachineInfo ?? {
      accessory: "Smart Handles",
      resistanceType: "cable",
      spotterDisabled: false,
      eccentricDisabled: false,
      chainsDisabled: false,
      burnoutDisabled: false,
    },
    trainingTypes: overrides.trainingTypes,
  };
}

function makeCatalog(): Movement[] {
  return [
    makeMovement({
      id: "1",
      name: "Bench Press",
      muscleGroups: ["Chest", "Triceps"],
      onMachineInfo: {
        accessory: "Smart Bar",
        resistanceType: "cable",
        spotterDisabled: false,
        eccentricDisabled: false,
        chainsDisabled: false,
        burnoutDisabled: false,
      },
    }),
    makeMovement({ id: "2", name: "Chest Fly", muscleGroups: ["Chest"] }),
    makeMovement({ id: "3", name: "Tricep Extension", muscleGroups: ["Triceps"] }),
    makeMovement({
      id: "4",
      name: "Shoulder Press",
      muscleGroups: ["Shoulders", "Triceps"],
      onMachineInfo: {
        accessory: "Smart Handles",
        resistanceType: "cable",
        spotterDisabled: false,
        eccentricDisabled: false,
        chainsDisabled: false,
        burnoutDisabled: false,
      },
    }),
    makeMovement({ id: "5", name: "Lateral Raise", muscleGroups: ["Shoulders"] }),
    makeMovement({
      id: "6",
      name: "Pushup",
      muscleGroups: ["Chest", "Triceps"],
      inFreeLift: true,
      onMachine: false,
      onMachineInfo: undefined,
    }),
    makeMovement({
      id: "7",
      name: "Squat",
      muscleGroups: ["Quads", "Glutes"],
      onMachineInfo: {
        accessory: "Smart Bar",
        resistanceType: "cable",
        spotterDisabled: false,
        eccentricDisabled: false,
        chainsDisabled: false,
        burnoutDisabled: false,
      },
    }),
    makeMovement({
      id: "8",
      name: "Deadlift",
      muscleGroups: ["Back", "Hamstrings", "Glutes"],
      onMachineInfo: {
        accessory: "Smart Bar",
        resistanceType: "cable",
        spotterDisabled: false,
        eccentricDisabled: false,
        chainsDisabled: false,
        burnoutDisabled: false,
      },
    }),
    makeMovement({ id: "9", name: "Row", muscleGroups: ["Back", "Biceps"] }),
    makeMovement({ id: "10", name: "Bicep Curl", muscleGroups: ["Biceps"] }),
  ];
}

describe("buildLibraryWorkout", () => {
  const catalog = makeCatalog();

  it("produces a workout with correct metadata", () => {
    const combo: LibraryCombo = {
      sessionType: "push",
      goal: "build_muscle",
      durationMinutes: 30,
      level: "intermediate",
      equipmentConfig: "handles_bar",
    };
    const result = buildLibraryWorkout(combo, catalog, []);
    expect(result).not.toBeNull();
    if (!result) return;
    expect(result.slug).toBe("push-build-muscle-30min-intermediate-handles-bar");
    expect(result.sessionType).toBe("push");
    expect(result.goal).toBe("build_muscle");
    expect(result.blocks.length).toBeGreaterThan(0);
    expect(result.movementDetails.length).toBeGreaterThan(0);
    expect(result.exerciseCount).toBeGreaterThan(0);
  });

  it("returns null when fewer than 3 exercises available", () => {
    const tinyCombo: LibraryCombo = {
      sessionType: "core",
      goal: "strength",
      durationMinutes: 20,
      level: "advanced",
      equipmentConfig: "bodyweight_only",
    };
    // With our test catalog, no core + bodyweight movements exist
    const result = buildLibraryWorkout(tinyCombo, catalog, []);
    expect(result).toBeNull();
  });

  it("applies rep/set scheme from goal", () => {
    const combo: LibraryCombo = {
      sessionType: "push",
      goal: "strength",
      durationMinutes: 45,
      level: "advanced",
      equipmentConfig: "full_accessories",
    };
    const result = buildLibraryWorkout(combo, catalog, []);
    if (!result) return;
    // Strength: 4 sets x 5 reps
    const mainExercises = result.movementDetails.filter((m) => m.phase === "main");
    expect(mainExercises[0].sets).toBe(4);
  });

  it("derives equipmentNeeded from movement accessories", () => {
    const combo: LibraryCombo = {
      sessionType: "push",
      goal: "build_muscle",
      durationMinutes: 30,
      level: "intermediate",
      equipmentConfig: "handles_bar",
    };
    const result = buildLibraryWorkout(combo, catalog, []);
    if (!result) return;
    expect(result.equipmentNeeded.length).toBeGreaterThan(0);
  });

  it("rotates exercises using recentMovementIds", () => {
    const combo: LibraryCombo = {
      sessionType: "push",
      goal: "build_muscle",
      durationMinutes: 30,
      level: "intermediate",
      equipmentConfig: "handles_bar",
    };
    const result1 = buildLibraryWorkout(combo, catalog, []);
    if (!result1) return;
    const ids1 = result1.movementDetails.map((m) => m.movementId);
    const result2 = buildLibraryWorkout(combo, catalog, ids1);
    if (!result2) return;
    const ids2 = result2.movementDetails.map((m) => m.movementId);
    // At least one different exercise if catalog has enough
    const uniqueToSecond = ids2.filter((id) => !ids1.includes(id));
    // May or may not differ depending on catalog size, but shouldn't be identical
    expect(ids2).not.toEqual(ids1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run convex/coach/libraryGeneration.test.ts`
Expected: FAIL - buildLibraryWorkout not exported

- [ ] **Step 3: Implement buildLibraryWorkout**

Add to `convex/coach/libraryGeneration.ts`:

```typescript
import {
  getRepSetScheme,
  getExcludedAccessoriesForConfig,
  getMaxExercises,
  getGoalLabel,
  getSessionTypeLabel,
  generateSlug,
  generateTitle,
  generateMetaTitle,
  type LibraryGoal,
  type LibrarySessionType,
  type LibraryLevel,
  type LibraryDuration,
  type LibraryEquipmentConfig,
} from "./goalConfig";
import { selectExercises } from "./exerciseSelection";
import {
  blocksFromMovementIds,
  sortForMinimalEquipmentSwitches,
  SESSION_TYPE_MUSCLES,
} from "./weekProgrammingHelpers";
import type { Movement } from "../tonal/types";

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

function preFilterCatalog(catalog: Movement[], combo: LibraryCombo): Movement[] {
  let filtered = catalog;

  // bodyweight_only: only inFreeLift movements
  if (combo.equipmentConfig === "bodyweight_only") {
    filtered = filtered.filter((m) => m.inFreeLift);
  }

  // mobility/recovery: filter by trainingType
  if (combo.sessionType === "mobility") {
    filtered = filtered.filter((m) =>
      m.trainingTypes?.some((t) => MOBILITY_TRAINING_TYPES.includes(t)),
    );
  } else if (combo.sessionType === "recovery") {
    filtered = filtered.filter((m) =>
      m.trainingTypes?.some((t) => RECOVERY_TRAINING_TYPES.includes(t)),
    );
  }

  return filtered;
}

export function buildLibraryWorkout(
  combo: LibraryCombo,
  catalog: Movement[],
  recentMovementIds: string[],
): LibraryWorkoutData | null {
  const filteredCatalog = preFilterCatalog(catalog, combo);
  const targetMuscles = SESSION_TYPE_MUSCLES[combo.sessionType] ?? [];
  const maxExercises = getMaxExercises(combo.durationMinutes);
  const scheme = getRepSetScheme(combo.goal);
  const excludedAccessories = getExcludedAccessoriesForConfig(combo.equipmentConfig);

  // Select main exercises
  const selectedIds = selectExercises({
    catalog: filteredCatalog,
    targetMuscleGroups: targetMuscles,
    userLevel: combo.level === "beginner" ? 1 : combo.level === "intermediate" ? 2 : 3,
    maxExercises,
    lastUsedMovementIds: [],
    constraints: {
      excludeAccessories: excludedAccessories,
    },
    recentWeeksMovementIds: recentMovementIds,
  });

  // Minimum exercise threshold
  if (selectedIds.length < 3) return null;

  // Sort for minimal equipment switching
  const sortedIds = sortForMinimalEquipmentSwitches(selectedIds, filteredCatalog);

  // Build blocks
  const catalogForBlocks = filteredCatalog.map((m) => ({
    id: m.id,
    countReps: m.countReps,
    onMachineInfo: m.onMachineInfo ? { accessory: m.onMachineInfo.accessory } : undefined,
  }));
  const blocks = blocksFromMovementIds(sortedIds, undefined, {
    catalog: catalogForBlocks,
  });

  // Build movement details
  const movementMap = new Map(filteredCatalog.map((m) => [m.id, m]));
  const movementDetails: MovementDetail[] = sortedIds.map((id) => {
    const mov = movementMap.get(id)!;
    return {
      movementId: id,
      name: mov.name,
      shortName: mov.shortName,
      muscleGroups: mov.muscleGroups,
      sets: scheme.sets,
      reps: scheme.reps,
      duration: scheme.duration,
      phase: "main" as const,
      thumbnailMediaUrl: mov.thumbnailMediaUrl,
      accessory: mov.onMachineInfo?.accessory,
    };
  });

  // Derive metadata
  const allMuscleGroups = [...new Set(movementDetails.flatMap((m) => m.muscleGroups))];
  const totalSets = movementDetails.reduce((sum, m) => sum + m.sets, 0);
  const equipmentNeeded = [
    ...new Set(movementDetails.map((m) => m.accessory).filter((a): a is string => a != null)),
  ];

  const title = generateTitle(combo);
  const slug = generateSlug(combo);

  return {
    slug,
    title,
    description: "", // Filled by LLM pass later
    sessionType: combo.sessionType,
    goal: combo.goal,
    durationMinutes: combo.durationMinutes,
    level: combo.level,
    equipmentConfig: combo.equipmentConfig,
    blocks,
    movementDetails,
    targetMuscleGroups: allMuscleGroups,
    exerciseCount: movementDetails.length,
    totalSets,
    equipmentNeeded,
    metaTitle: generateMetaTitle(title),
    metaDescription: "", // Filled by LLM pass later
    generationVersion: 1,
    createdAt: Date.now(),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run convex/coach/libraryGeneration.test.ts`
Expected: All PASS

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add convex/coach/libraryGeneration.ts convex/coach/libraryGeneration.test.ts
git commit -m "feat: add workout builder for library generation"
```

---

## Task 5: Convex Schema and Queries

**Files:**

- Modify: `convex/schema.ts` (add libraryWorkouts table after line 468)
- Create: `convex/libraryWorkouts.ts`

- [ ] **Step 1: Add libraryWorkouts table to schema**

At `convex/schema.ts`, add the table definition. Import the needed validators and add the table before the closing of the schema definition:

```typescript
libraryWorkouts: defineTable({
  slug: v.string(),
  title: v.string(),
  description: v.string(),
  sessionType: v.string(),
  goal: v.string(),
  durationMinutes: v.number(),
  level: v.string(),
  equipmentConfig: v.string(),
  blocks: blockInputValidator,
  movementDetails: v.array(
    v.object({
      movementId: v.string(),
      name: v.string(),
      shortName: v.string(),
      muscleGroups: v.array(v.string()),
      sets: v.number(),
      reps: v.optional(v.number()),
      duration: v.optional(v.number()),
      phase: v.union(
        v.literal("warmup"),
        v.literal("main"),
        v.literal("cooldown"),
      ),
      thumbnailMediaUrl: v.optional(v.string()),
      accessory: v.optional(v.string()),
    }),
  ),
  targetMuscleGroups: v.array(v.string()),
  exerciseCount: v.number(),
  totalSets: v.number(),
  equipmentNeeded: v.array(v.string()),
  metaTitle: v.string(),
  metaDescription: v.string(),
  generationVersion: v.number(),
  createdAt: v.number(),
})
  .index("by_slug", ["slug"])
  .index("by_goal", ["goal"])
  .index("by_sessionType", ["sessionType"])
  .index("by_level", ["level"])
  .index("by_durationMinutes", ["durationMinutes"])
  .index("by_equipmentConfig", ["equipmentConfig"])
  .index("by_generationVersion", ["generationVersion"]),
```

- [ ] **Step 2: Create public queries**

```typescript
// convex/libraryWorkouts.ts
import { query } from "./_generated/server";
import { v } from "convex/values";

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    return ctx.db
      .query("libraryWorkouts")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
  },
});

export const listAll = query({
  args: {},
  handler: async (ctx) => {
    const workouts = await ctx.db.query("libraryWorkouts").collect();
    // Return lightweight version for browse page (no blocks or full movementDetails)
    return workouts.map((w) => ({
      _id: w._id,
      slug: w.slug,
      title: w.title,
      description: w.description,
      sessionType: w.sessionType,
      goal: w.goal,
      durationMinutes: w.durationMinutes,
      level: w.level,
      equipmentConfig: w.equipmentConfig,
      targetMuscleGroups: w.targetMuscleGroups,
      exerciseCount: w.exerciseCount,
      totalSets: w.totalSets,
      equipmentNeeded: w.equipmentNeeded,
    }));
  },
});

export const getSlugs = query({
  args: {},
  handler: async (ctx) => {
    const workouts = await ctx.db.query("libraryWorkouts").collect();
    return workouts.map((w) => w.slug);
  },
});

export const getRelated = query({
  args: { slug: v.string(), limit: v.number() },
  handler: async (ctx, { slug, limit }) => {
    const current = await ctx.db
      .query("libraryWorkouts")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (!current) return [];

    // Find workouts with same sessionType or goal, exclude current
    const sameSession = await ctx.db
      .query("libraryWorkouts")
      .withIndex("by_sessionType", (q) => q.eq("sessionType", current.sessionType))
      .collect();

    const related = sameSession.filter((w) => w.slug !== slug).slice(0, limit);

    // If not enough, fill with same goal
    if (related.length < limit) {
      const sameGoal = await ctx.db
        .query("libraryWorkouts")
        .withIndex("by_goal", (q) => q.eq("goal", current.goal))
        .collect();
      const existing = new Set(related.map((r) => r.slug));
      existing.add(slug);
      for (const w of sameGoal) {
        if (related.length >= limit) break;
        if (!existing.has(w.slug)) {
          related.push(w);
          existing.add(w.slug);
        }
      }
    }

    return related.map((w) => ({
      slug: w.slug,
      title: w.title,
      sessionType: w.sessionType,
      goal: w.goal,
      durationMinutes: w.durationMinutes,
      level: w.level,
      exerciseCount: w.exerciseCount,
    }));
  },
});
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Deploy schema to dev**

Run: `npx convex dev` (confirm schema push succeeds)
Expected: Schema accepted, new table visible

- [ ] **Step 5: Commit**

```bash
git add convex/schema.ts convex/libraryWorkouts.ts
git commit -m "feat: add libraryWorkouts table and public queries"
```

---

## Task 6: Generation Convex Action

**Files:**

- Modify: `convex/coach/libraryGeneration.ts`

Add the Convex action that orchestrates generation: loads catalog, enumerates combos, builds workouts, writes to DB.

- [ ] **Step 1: Add internal mutation for upserting workouts**

Add to `convex/coach/libraryGeneration.ts`:

```typescript
import { internalAction, internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";

export const upsertLibraryWorkout = internalMutation({
  args: {
    slug: v.string(),
    data: v.any(), // Full workout data object
  },
  handler: async (ctx, { slug, data }) => {
    const existing = await ctx.db
      .query("libraryWorkouts")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, data);
    } else {
      await ctx.db.insert("libraryWorkouts", data);
    }
  },
});
```

- [ ] **Step 2: Add generation action for a batch of session types**

```typescript
export const generateBatch = internalAction({
  args: {
    sessionTypes: v.array(v.string()),
    generationVersion: v.number(),
  },
  handler: async (ctx, { sessionTypes, generationVersion }) => {
    // Load movement catalog
    const catalog = await ctx.runQuery(internal.tonal.movementSync.getAllMovements);

    const combos = enumerateValidCombos().filter((c) => sessionTypes.includes(c.sessionType));

    let created = 0;
    let skipped = 0;
    const recentBySession: Record<string, string[]> = {};

    for (const combo of combos) {
      const recent = recentBySession[combo.sessionType] ?? [];
      const workout = buildLibraryWorkout(combo, catalog, recent);

      if (!workout) {
        skipped++;
        continue;
      }

      workout.generationVersion = generationVersion;

      // Track movement IDs for variation
      const ids = workout.movementDetails.map((m) => m.movementId);
      recentBySession[combo.sessionType] = [...recent, ...ids].slice(-30); // Keep last 30 for rotation

      await ctx.runMutation(internal.coach.libraryGeneration.upsertLibraryWorkout, {
        slug: workout.slug,
        data: workout,
      });
      created++;
    }

    return { created, skipped, total: combos.length };
  },
});
```

- [ ] **Step 3: Add orchestrator action that kicks off all batches**

```typescript
export const generateAll = internalAction({
  args: { generationVersion: v.number() },
  handler: async (ctx, { generationVersion }) => {
    // Process in batches by session type to stay under timeout
    const sessionTypeBatches: LibrarySessionType[][] = [
      ["push", "pull"],
      ["legs", "upper"],
      ["lower", "full_body"],
      ["chest", "back"],
      ["shoulders", "arms"],
      ["core", "glutes_hamstrings"],
      ["chest_back", "mobility"],
      ["recovery"],
    ];

    const results = [];
    for (const batch of sessionTypeBatches) {
      const result = await ctx.runAction(internal.coach.libraryGeneration.generateBatch, {
        sessionTypes: batch,
        generationVersion,
      });
      results.push({ batch, ...result });
    }

    return results;
  },
});
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add convex/coach/libraryGeneration.ts
git commit -m "feat: add Convex generation actions for workout library"
```

---

## Task 7: Route Migration (workouts -> activity)

**Files:**

- Move: `src/app/(app)/workouts/` -> `src/app/(app)/activity/`
- Modify: `src/app/robots.ts:3-19`
- Grep and update any internal `/workouts/` links

- [ ] **Step 1: Move the directory**

```bash
mv src/app/\(app\)/workouts src/app/\(app\)/activity
```

- [ ] **Step 2: Update robots.ts - change /workouts to /activity**

In `src/app/robots.ts`, in the APP_ROUTES array (lines 3-19), change `"/workouts"` to `"/activity"`.

- [ ] **Step 3: Find and update all internal links referencing /workouts/**

Run: `grep -r "/workouts" src/ --include="*.tsx" --include="*.ts" -l`

Update each file that links to `/workouts/` for the authenticated workout history to use `/activity/` instead. Common locations: navigation components, chat responses, dashboard links.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: rename /workouts to /activity for authenticated workout history"
```

---

## Task 8: Public Layout and Browse Page

**Files:**

- Create: `src/app/workouts/layout.tsx`
- Create: `src/app/workouts/page.tsx`
- Create: `src/app/workouts/_components/WorkoutFilters.tsx`
- Create: `src/app/workouts/_components/WorkoutLibraryCard.tsx`

- [ ] **Step 1: Create public workout layout**

```typescript
// src/app/workouts/layout.tsx
import { SiteNav } from "../_components/SiteNav";
import { SiteFooter } from "../_components/SiteFooter";

export default function WorkoutsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteNav />
      <main className="min-h-screen">{children}</main>
      <SiteFooter />
    </>
  );
}
```

- [ ] **Step 2: Create WorkoutFilters client component**

Read the existing app's filter/pill patterns first. Create `src/app/workouts/_components/WorkoutFilters.tsx` as a `"use client"` component that:

- Reads URL search params for active filters
- Renders pill rows for goal, sessionType, duration, level
- Updates URL params on click (using `useRouter` and `useSearchParams`)
- Maps internal values to human labels using `getGoalLabel` and `getSessionTypeLabel`

- [ ] **Step 3: Create WorkoutLibraryCard component**

Create `src/app/workouts/_components/WorkoutLibraryCard.tsx`:

- Displays: session type + goal tags, title, description (truncated), duration/level/exercise count
- Links to `/workouts/{slug}`
- Uses shadcn Card component if available, otherwise simple div with Tailwind

- [ ] **Step 4: Create browse page**

```typescript
// src/app/workouts/page.tsx
import type { Metadata } from "next";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { WorkoutFilters } from "./_components/WorkoutFilters";
import { WorkoutLibraryCard } from "./_components/WorkoutLibraryCard";

export const metadata: Metadata = {
  title: "Free Tonal Workouts | tonal.coach",
  description:
    "Browse 800+ expert-designed Tonal workouts for every goal, muscle group, and experience level. Free workout library.",
};

export default async function WorkoutsPage() {
  const workouts = await fetchQuery(api.libraryWorkouts.listAll);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="mb-8 text-center">
        <h1 className="mb-2 text-3xl font-bold">Free Tonal Workouts</h1>
        <p className="text-muted-foreground">
          Browse {workouts.length}+ expert-designed workouts for every goal,
          muscle group, and experience level.
        </p>
      </div>
      <WorkoutFilters />
      {/* Client-side filtering renders cards based on URL params */}
      {/* Pass workouts as serialized data to client component */}
    </div>
  );
}
```

Note: The browse page needs a client component wrapper that receives all workouts as props and filters them based on URL search params. The page.tsx fetches at build time (SSG), passes to a client component for interactive filtering.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/app/workouts/
git commit -m "feat: add public browse page with filters for workout library"
```

---

## Task 9: Detail Page and OG Image

**Files:**

- Create: `src/app/workouts/[slug]/page.tsx`
- Create: `src/app/workouts/[slug]/opengraph-image.tsx`
- Create: `src/app/workouts/_components/WorkoutBlockDisplay.tsx`
- Create: `src/app/workouts/_components/WorkoutCtaBanner.tsx`
- Create: `src/app/workouts/_components/RelatedWorkouts.tsx`
- Create: `src/app/workouts/_components/WorkoutJsonLd.tsx`

- [ ] **Step 1: Create WorkoutBlockDisplay component**

Renders workout blocks with:

- Block header showing accessory name and "Superset" badge when block has 2+ exercises
- Exercise rows with thumbnail placeholder, name, muscle groups, sets x reps
- Read the existing authenticated workout detail page at `src/app/(app)/activity/[activityId]/components.tsx` for reference patterns

- [ ] **Step 2: Create WorkoutCtaBanner component**

```typescript
// src/app/workouts/_components/WorkoutCtaBanner.tsx
import Link from "next/link";

export function WorkoutCtaBanner() {
  return (
    <div className="my-8 rounded-xl border border-blue-500/20 bg-gradient-to-br from-blue-950/50 to-background p-8 text-center">
      <h3 className="mb-3 text-xl font-semibold">
        Want this personalized for you?
      </h3>
      <p className="text-muted-foreground mx-auto mb-6 max-w-lg text-sm leading-relaxed">
        This is a template workout. Connect your Tonal and the AI coach adjusts
        weights to your strength scores, swaps exercises around injuries, and
        progresses you week over week.
      </p>
      <Link
        href="/waitlist"
        className="bg-primary text-primary-foreground hover:bg-primary/90 inline-block rounded-lg px-6 py-3 font-medium"
      >
        Start Free with AI Coach
      </Link>
    </div>
  );
}
```

- [ ] **Step 3: Create RelatedWorkouts component**

Renders 3 related workout cards in a grid. Takes workout slug and fetches related via `getRelated` query.

- [ ] **Step 4: Create WorkoutJsonLd component**

```typescript
// src/app/workouts/_components/WorkoutJsonLd.tsx
export function WorkoutJsonLd({ workout }: { workout: LibraryWorkout }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ExercisePlan",
    name: workout.title,
    description: workout.description,
    exerciseType: workout.sessionType,
    activityDuration: `PT${workout.durationMinutes}M`,
    intensity: workout.level,
    workload: `${workout.totalSets} total sets`,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
```

- [ ] **Step 5: Create detail page with SSG**

```typescript
// src/app/workouts/[slug]/page.tsx
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { notFound } from "next/navigation";
import { WorkoutBlockDisplay } from "../_components/WorkoutBlockDisplay";
import { WorkoutCtaBanner } from "../_components/WorkoutCtaBanner";
import { RelatedWorkouts } from "../_components/RelatedWorkouts";
import { WorkoutJsonLd } from "../_components/WorkoutJsonLd";

export async function generateStaticParams() {
  const slugs = await fetchQuery(api.libraryWorkouts.getSlugs);
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const workout = await fetchQuery(api.libraryWorkouts.getBySlug, { slug });
  if (!workout) return {};
  return {
    title: workout.metaTitle,
    description: workout.metaDescription || workout.description,
  };
}

export const revalidate = 3600; // ISR: 1 hour

export default async function WorkoutDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const workout = await fetchQuery(api.libraryWorkouts.getBySlug, { slug });
  if (!workout) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <WorkoutJsonLd workout={workout} />
      {/* Breadcrumbs */}
      {/* Title + description */}
      {/* Quick stats bar */}
      <WorkoutBlockDisplay blocks={workout.blocks} movementDetails={workout.movementDetails} />
      <WorkoutCtaBanner />
      <RelatedWorkouts slug={slug} />
    </div>
  );
}
```

- [ ] **Step 6: Create OG image**

Create `src/app/workouts/[slug]/opengraph-image.tsx` using Satori (Next.js ImageResponse). Display: workout title, duration, level, target muscle groups. Dark background matching site theme. Reference `src/app/opengraph-image.tsx` if one exists for patterns.

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 8: Commit**

```bash
git add src/app/workouts/
git commit -m "feat: add workout detail page with SSG, OG images, and CTA"
```

---

## Task 10: SEO Integration

**Files:**

- Modify: `src/app/sitemap.ts`
- Modify: `src/app/page.tsx`
- Modify: `src/app/_components/SiteNav.tsx:4-9`
- Modify: `src/app/_components/SiteFooter.tsx:3-7`

- [ ] **Step 1: Add workout URLs to sitemap**

In `src/app/sitemap.ts`, add workout slugs fetched from Convex:

```typescript
import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";

// Inside the sitemap function, after existing URLs:
const slugs = await fetchQuery(api.libraryWorkouts.getSlugs);
const workoutUrls = slugs.map((slug) => ({
  url: `https://tonal.coach/workouts/${slug}`,
  lastModified: new Date(),
  changeFrequency: "weekly" as const,
  priority: 0.8,
}));
```

- [ ] **Step 2: Add "Workouts" to SiteNav**

In `src/app/_components/SiteNav.tsx`, add to NAV_LINKS (lines 4-9):

```typescript
{ href: "/workouts", label: "Workouts" },
```

- [ ] **Step 3: Add "Workout Library" to SiteFooter**

In `src/app/_components/SiteFooter.tsx`, add to PRODUCT_LINKS (lines 3-7):

```typescript
{ href: "/workouts", label: "Workout Library" },
```

- [ ] **Step 4: Add "Browse Workouts" section to landing page**

In `src/app/page.tsx`, add a section before PricingTeaser (around line 169). Show 6 featured workout cards with a "Browse All Workouts" link. Fetch a sample via `fetchQuery(api.libraryWorkouts.listAll)` and pick 6 diverse ones.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/app/sitemap.ts src/app/_components/SiteNav.tsx src/app/_components/SiteFooter.tsx src/app/page.tsx
git commit -m "feat: integrate workout library into sitemap, nav, footer, and landing page"
```

---

## Task 11: LLM Description Generation Action

**Files:**

- Modify: `convex/coach/libraryGeneration.ts`

Separate action that generates descriptions for workouts that have empty descriptions.

- [ ] **Step 1: Add description generation action**

```typescript
export const generateDescriptions = internalAction({
  args: { batchSize: v.optional(v.number()) },
  handler: async (ctx, { batchSize = 20 }) => {
    // Query workouts with empty descriptions
    const allWorkouts = await ctx.runQuery(
      internal.coach.libraryGeneration.getWorkoutsNeedingDescriptions,
    );

    const batch = allWorkouts.slice(0, batchSize);
    if (batch.length === 0) return { processed: 0, remaining: 0 };

    // Build prompt for batch
    const prompt = batch.map((w) => ({
      slug: w.slug,
      title: w.title,
      sessionType: w.sessionType,
      goal: w.goal,
      level: w.level,
      durationMinutes: w.durationMinutes,
      exerciseCount: w.exerciseCount,
      targetMuscleGroups: w.targetMuscleGroups,
    }));

    // Call LLM for descriptions (use existing AI action patterns)
    // Each description: 2-3 sentences, ~155 chars for meta description
    // Store both description and metaDescription

    // Update each workout with its description
    for (const item of results) {
      await ctx.runMutation(internal.coach.libraryGeneration.updateDescription, {
        slug: item.slug,
        description: item.description,
        metaDescription: item.metaDescription,
      });
    }

    return {
      processed: batch.length,
      remaining: allWorkouts.length - batch.length,
    };
  },
});
```

Note: Adapt to the project's existing AI/LLM patterns. Check `convex/ai/` for how the project calls LLMs. Use structured output for reliable parsing.

- [ ] **Step 2: Add supporting query and mutation**

```typescript
export const getWorkoutsNeedingDescriptions = internalQuery({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("libraryWorkouts").collect();
    return all.filter((w) => !w.description || w.description === "");
  },
});

export const updateDescription = internalMutation({
  args: {
    slug: v.string(),
    description: v.string(),
    metaDescription: v.string(),
  },
  handler: async (ctx, { slug, description, metaDescription }) => {
    const workout = await ctx.db
      .query("libraryWorkouts")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (workout) {
      await ctx.db.patch(workout._id, { description, metaDescription });
    }
  },
});
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add convex/coach/libraryGeneration.ts
git commit -m "feat: add LLM description generation for library workouts"
```

---

## Task 12: End-to-End Verification

**Files:** No new files. Verification only.

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Type-check full project**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Generate a small test batch**

From Convex dashboard or via a temporary test script, run `generateBatch` with a single session type (e.g., `["push"]`) and `generationVersion: 1`. Verify workouts appear in the `libraryWorkouts` table.

- [ ] **Step 4: Verify frontend pages**

Start dev server (`npm run dev`) and verify:

- `/workouts` loads with the generated workouts
- Filter pills work and update URL params
- `/workouts/{slug}` renders a detail page with blocks and exercises
- CTA banner displays correctly
- Related workouts section shows cards
- SiteNav and SiteFooter have "Workouts" links

- [ ] **Step 5: Verify SEO elements**

- View page source of a detail page: check meta title, description, canonical URL
- Check JSON-LD script tag is present
- Verify OG image renders at `/workouts/{slug}/opengraph-image`
- Check sitemap includes workout URLs

- [ ] **Step 6: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address verification issues in workout library"
```
