# Movement Training Type Classification — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Classify movements by training type (Warm-up, Mobility, Recovery, etc.) derived from Tonal's curated workout catalog, then use those classifications to auto-generate warmup and cooldown blocks in weekly programming.

**Architecture:** A weekly cron fetches Tonal's explore/workouts catalog, extracts which movements appear in each training type's workouts, and writes a `trainingTypes` string array to each movement record. New exercise selection functions filter by training type for warmup/cooldown blocks. Weekly programming prepends/appends these blocks automatically.

**Tech Stack:** Convex (actions, mutations, queries), Tonal API (`/v6/training-types`, `/v6/explore/workouts`, `/v6/workouts/{id}`), Vitest

**Spec:** `docs/superpowers/specs/2026-03-16-movement-training-types-design.md`

---

## File Map

| File                                      | Action | Responsibility                                                                                                |
| ----------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------- |
| `convex/tonal/types.ts`                   | Modify | Add `trainingTypes` to Movement, new TrainingType/TonalWorkoutDetail/TonalExploreTile/TonalExploreGroup types |
| `convex/schema.ts`                        | Modify | Add `trainingTypes` field to movements table, new `trainingTypes` table                                       |
| `convex/tonal/movementSync.ts`            | Modify | Switch `updateMovement` from `db.replace` to `db.patch`, add `trainingTypes` to query output mappings         |
| `convex/tonal/workoutCatalogSync.ts`      | Create | Weekly sync action: fetch training types, explore workouts, workout details; tag movements                    |
| `convex/tonal/workoutCatalogSync.test.ts` | Create | Unit tests for the sync logic                                                                                 |
| `convex/crons.ts`                         | Modify | Add weekly cron for workout catalog sync                                                                      |
| `convex/coach/exerciseSelection.ts`       | Modify | Add `selectWarmupExercises()` and `selectCooldownExercises()`                                                 |
| `convex/coach/exerciseSelection.test.ts`  | Modify | Tests for warmup/cooldown selection + fallback behavior                                                       |
| `convex/coach/weekProgrammingHelpers.ts`  | Modify | Add warmup/cooldown block builders, duration tier constants                                                   |
| `convex/coach/weekProgramming.ts`         | Modify | Prepend warmup blocks, append cooldown blocks per session                                                     |
| `convex/ai/tools.ts`                      | Modify | Add `trainingType` filter to `searchExercisesTool`                                                            |
| `convex/ai/coach.ts`                      | Modify | Update WARM-UP & COOL-DOWN system prompt section                                                              |
| `convex/mcp/tools/exercises.ts`           | Modify | Add `trainingType` to responses and search filter                                                             |

---

## Task 1: Add types and schema

**Files:**

- Modify: `convex/tonal/types.ts`
- Modify: `convex/schema.ts`

- [ ] **Step 1: Add types to `convex/tonal/types.ts`**

After the existing `Movement` interface (line 47), add `trainingTypes` field. After `WorkoutEstimate` (line 221), add new types:

```typescript
// In Movement interface, add after line 46 (before closing brace):
  trainingTypes?: string[];

// After WorkoutEstimate interface:

// Training type from GET /v6/training-types
export interface TrainingType {
  id: string;
  name: string;
  description: string;
}

// Workout detail from GET /v6/workouts/{workoutId}
export interface TonalWorkoutDetail {
  id: string;
  sets: Array<{ movementId: string }>;
}

// Tile from GET /v6/explore/workouts
export interface TonalExploreTile {
  workoutId: string;
  trainingTypeIds: string[];
  publishedAt?: string;
}

// Group from GET /v6/explore/workouts
export interface TonalExploreGroup {
  title: string;
  total: number;
  tiles: TonalExploreTile[];
}
```

- [ ] **Step 2: Add schema changes to `convex/schema.ts`**

Add `trainingTypes` field to the `movements` table (after `lastSyncedAt` on line 152):

```typescript
    trainingTypes: v.optional(v.array(v.string())),
```

Add new `trainingTypes` table after the `movements` table definition (after line 155):

```typescript
  trainingTypes: defineTable({
    tonalId: v.string(),
    name: v.string(),
    description: v.string(),
    lastSyncedAt: v.number(),
  }).index("by_tonalId", ["tonalId"]),
```

- [ ] **Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS (additive changes only)

- [ ] **Step 4: Commit**

```bash
git add convex/tonal/types.ts convex/schema.ts
git commit -m "feat: add training type schema and types for movement classification"
```

---

## Task 2: Fix movementSync to preserve trainingTypes

**Files:**

- Modify: `convex/tonal/movementSync.ts`

- [ ] **Step 1: Change `updateMovement` from `db.replace` to `db.patch`**

In `convex/tonal/movementSync.ts`, the `updateMovement` mutation (line 139-147) currently uses `db.replace` which would erase `trainingTypes`. Change to `db.patch`:

```typescript
// Line 145, change:
await ctx.db.replace(id, fields);
// To:
await ctx.db.patch(id, fields);
```

- [ ] **Step 2: Add `trainingTypes` to `getAllMovements` output mapping**

In `getAllMovements` (line 153-176), add `trainingTypes` to the return mapping. After `onMachineInfo: doc.onMachineInfo,` (line 173), add:

```typescript
      trainingTypes: doc.trainingTypes,
```

- [ ] **Step 3: Add `trainingTypes` to `getByTonalIds` output mapping**

In `getByTonalIds` (line 179-212), add `trainingTypes` to the return mapping. After `onMachineInfo: doc.onMachineInfo,` (line 206), add:

```typescript
          trainingTypes: doc.trainingTypes,
```

- [ ] **Step 4: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Run existing tests**

Run: `npx vitest run convex/coach/exerciseSelection.test.ts`
Expected: All existing tests PASS (no behavioral change)

- [ ] **Step 6: Commit**

```bash
git add convex/tonal/movementSync.ts
git commit -m "fix: switch movementSync to db.patch to preserve trainingTypes field"
```

---

## Task 3: Build workout catalog sync

**Files:**

- Create: `convex/tonal/workoutCatalogSync.ts`
- Create: `convex/tonal/workoutCatalogSync.test.ts`
- Modify: `convex/crons.ts`

- [ ] **Step 1: Write test for `buildMovementTrainingTypeMap`**

Create `convex/tonal/workoutCatalogSync.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { buildMovementTrainingTypeMap } from "./workoutCatalogSync";

describe("buildMovementTrainingTypeMap", () => {
  const typeMap = new Map([
    ["type-1", "Warm-up"],
    ["type-2", "Mobility"],
    ["type-3", "Strength"],
  ]);

  it("tags movement with all training types from workouts it appears in", () => {
    const workoutTiles = [
      { workoutId: "w1", trainingTypeIds: ["type-1"] },
      { workoutId: "w2", trainingTypeIds: ["type-2"] },
    ];
    const workoutDetails = new Map([
      ["w1", ["mov-a", "mov-b"]],
      ["w2", ["mov-a", "mov-c"]],
    ]);

    const result = buildMovementTrainingTypeMap(workoutTiles, workoutDetails, typeMap);

    expect(result.get("mov-a")).toEqual(expect.arrayContaining(["Warm-up", "Mobility"]));
    expect(result.get("mov-b")).toEqual(["Warm-up"]);
    expect(result.get("mov-c")).toEqual(["Mobility"]);
  });

  it("handles workout with multiple training type IDs", () => {
    const workoutTiles = [{ workoutId: "w1", trainingTypeIds: ["type-1", "type-3"] }];
    const workoutDetails = new Map([["w1", ["mov-a"]]]);

    const result = buildMovementTrainingTypeMap(workoutTiles, workoutDetails, typeMap);

    expect(result.get("mov-a")).toEqual(expect.arrayContaining(["Warm-up", "Strength"]));
  });

  it("skips workouts with no detail (failed fetch)", () => {
    const workoutTiles = [
      { workoutId: "w1", trainingTypeIds: ["type-1"] },
      { workoutId: "w-missing", trainingTypeIds: ["type-2"] },
    ];
    const workoutDetails = new Map([["w1", ["mov-a"]]]);

    const result = buildMovementTrainingTypeMap(workoutTiles, workoutDetails, typeMap);

    expect(result.get("mov-a")).toEqual(["Warm-up"]);
    expect(result.size).toBe(1);
  });

  it("skips unknown training type IDs", () => {
    const workoutTiles = [{ workoutId: "w1", trainingTypeIds: ["type-unknown"] }];
    const workoutDetails = new Map([["w1", ["mov-a"]]]);

    const result = buildMovementTrainingTypeMap(workoutTiles, workoutDetails, typeMap);

    // mov-a gets an empty array since type-unknown isn't in the map
    expect(result.has("mov-a")).toBe(false);
  });

  it("returns empty map for empty inputs", () => {
    const result = buildMovementTrainingTypeMap([], new Map(), typeMap);
    expect(result.size).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run convex/tonal/workoutCatalogSync.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `workoutCatalogSync.ts`**

Create `convex/tonal/workoutCatalogSync.ts`:

```typescript
/**
 * Workout catalog sync: derives movement training types from Tonal's curated workouts.
 *
 * Weekly cron fetches /v6/training-types and /v6/explore/workouts, then fetches
 * individual workout details to map movementId -> trainingType[]. Writes results
 * to the movements table via db.patch.
 */

import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import { tonalFetch } from "./client";
import { withTokenRetry } from "./tokenRetry";
import type { TrainingType, TonalExploreGroup, TonalWorkoutDetail } from "./types";

const BATCH_SIZE = 20;

/**
 * Pure function: build a Map<movementId, trainingTypeName[]> from workout tiles and details.
 * Exported for testing.
 */
export function buildMovementTrainingTypeMap(
  workoutTiles: Array<{ workoutId: string; trainingTypeIds: string[] }>,
  workoutDetails: Map<string, string[]>, // workoutId -> movementIds
  typeMap: Map<string, string>, // typeId -> typeName
): Map<string, string[]> {
  const movementTypes = new Map<string, Set<string>>();

  for (const tile of workoutTiles) {
    const movementIds = workoutDetails.get(tile.workoutId);
    if (!movementIds) continue;

    const typeNames = tile.trainingTypeIds
      .map((id) => typeMap.get(id))
      .filter((name): name is string => name !== undefined);

    if (typeNames.length === 0) continue;

    for (const movementId of movementIds) {
      let existing = movementTypes.get(movementId);
      if (!existing) {
        existing = new Set();
        movementTypes.set(movementId, existing);
      }
      for (const name of typeNames) {
        existing.add(name);
      }
    }
  }

  const result = new Map<string, string[]>();
  for (const [movementId, types] of movementTypes) {
    result.set(movementId, [...types].sort());
  }
  return result;
}

/** Fetch workout details in parallel batches. Returns Map<workoutId, movementId[]>. */
async function fetchWorkoutDetails(
  token: string,
  workoutIds: string[],
): Promise<Map<string, string[]>> {
  const details = new Map<string, string[]>();

  for (let i = 0; i < workoutIds.length; i += BATCH_SIZE) {
    const batch = workoutIds.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (id) => {
        const detail = await tonalFetch<TonalWorkoutDetail>(token, `/v6/workouts/${id}`);
        return { id, movementIds: [...new Set(detail.sets.map((s) => s.movementId))] };
      }),
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        details.set(result.value.id, result.value.movementIds);
      }
      // Failed fetches are silently skipped — next sync picks them up
    }
  }

  return details;
}

/** Upsert a training type record. */
export const upsertTrainingType = internalMutation({
  args: {
    tonalId: v.string(),
    name: v.string(),
    description: v.string(),
  },
  handler: async (ctx, { tonalId, name, description }) => {
    const existing = await ctx.db
      .query("trainingTypes")
      .withIndex("by_tonalId", (q) => q.eq("tonalId", tonalId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { name, description, lastSyncedAt: Date.now() });
    } else {
      await ctx.db.insert("trainingTypes", {
        tonalId,
        name,
        description,
        lastSyncedAt: Date.now(),
      });
    }
  },
});

/** Update a single movement's trainingTypes by tonalId. */
export const updateMovementTrainingTypes = internalMutation({
  args: {
    tonalId: v.string(),
    trainingTypes: v.array(v.string()),
  },
  handler: async (ctx, { tonalId, trainingTypes }) => {
    const doc = await ctx.db
      .query("movements")
      .withIndex("by_tonalId", (q) => q.eq("tonalId", tonalId))
      .unique();
    if (doc) {
      await ctx.db.patch(doc._id, { trainingTypes });
    }
  },
});

/** Get all training types from the table. */
export const getAllTrainingTypes = internalQuery({
  handler: async (ctx) => {
    return ctx.db.query("trainingTypes").collect();
  },
});

/** Main sync action: fetch training types + workout catalog, tag movements. */
export const syncWorkoutCatalog = internalAction({
  handler: async (ctx) => {
    // Pick any active user's token (catalog is global)
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const activeUsers = await ctx.runQuery(internal.userProfiles.getActiveUsers, {
      sinceTimestamp: oneDayAgo,
    });

    if (activeUsers.length === 0) {
      console.warn("[workoutCatalogSync] No active users — skipping");
      return;
    }

    // Use withTokenRetry for automatic 401 retry (matches movementSync pattern)
    await withTokenRetry(ctx, activeUsers[0].userId, async (token) => {
      // 1. Fetch and upsert training types
      const trainingTypes = await tonalFetch<TrainingType[]>(token, "/v6/training-types");
      const typeMap = new Map<string, string>();
      for (const tt of trainingTypes) {
        typeMap.set(tt.id, tt.name);
        await ctx.runMutation(internal.tonal.workoutCatalogSync.upsertTrainingType, {
          tonalId: tt.id,
          name: tt.name,
          description: tt.description ?? "",
        });
      }
      console.log(`[workoutCatalogSync] Synced ${trainingTypes.length} training types`);

      // 2. Fetch explore workouts catalog
      const exploreGroups = await tonalFetch<TonalExploreGroup[]>(token, "/v6/explore/workouts");

      // Flatten all tiles with their training type IDs
      const allTiles: Array<{ workoutId: string; trainingTypeIds: string[] }> = [];
      for (const group of exploreGroups) {
        for (const tile of group.tiles) {
          if (tile.trainingTypeIds?.length > 0) {
            allTiles.push({
              workoutId: tile.workoutId,
              trainingTypeIds: tile.trainingTypeIds,
            });
          }
        }
      }

      // Deduplicate by workoutId (same workout can appear in multiple groups)
      const uniqueTiles = new Map<string, { workoutId: string; trainingTypeIds: string[] }>();
      for (const tile of allTiles) {
        const existing = uniqueTiles.get(tile.workoutId);
        if (existing) {
          const merged = new Set([...existing.trainingTypeIds, ...tile.trainingTypeIds]);
          uniqueTiles.set(tile.workoutId, {
            workoutId: tile.workoutId,
            trainingTypeIds: [...merged],
          });
        } else {
          uniqueTiles.set(tile.workoutId, tile);
        }
      }

      const tiles = [...uniqueTiles.values()];
      console.log(`[workoutCatalogSync] Found ${tiles.length} unique curated workouts`);

      // 3. Fetch workout details to get movementIds (deduplicate within each workout)
      const workoutIds = tiles.map((t) => t.workoutId);
      const workoutDetails = await fetchWorkoutDetails(token, workoutIds);
      console.log(
        `[workoutCatalogSync] Fetched details for ${workoutDetails.size}/${workoutIds.length} workouts`,
      );

      // 4. Build movement -> trainingTypes mapping
      const movementTypeMap = buildMovementTrainingTypeMap(tiles, workoutDetails, typeMap);

      // 5. Write trainingTypes to each movement
      let updated = 0;
      for (const [movementId, types] of movementTypeMap) {
        await ctx.runMutation(internal.tonal.workoutCatalogSync.updateMovementTrainingTypes, {
          tonalId: movementId,
          trainingTypes: types,
        });
        updated++;
      }

      console.log(`[workoutCatalogSync] Tagged ${updated} movements with training types`);
    });
  },
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run convex/tonal/workoutCatalogSync.test.ts`
Expected: All 5 tests PASS

- [ ] **Step 5: Add weekly cron to `convex/crons.ts`**

After the movement sync cron (line 34), add:

```typescript
crons.cron(
  "sync-workout-catalog",
  "0 4 * * 0",
  internal.tonal.workoutCatalogSync.syncWorkoutCatalog,
);
```

- [ ] **Step 6: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add convex/tonal/workoutCatalogSync.ts convex/tonal/workoutCatalogSync.test.ts convex/crons.ts
git commit -m "feat: add workout catalog sync to classify movements by training type"
```

---

## Task 4: Add warmup and cooldown exercise selection

**Files:**

- Modify: `convex/coach/exerciseSelection.ts`
- Modify: `convex/coach/exerciseSelection.test.ts`

- [ ] **Step 1: Write failing tests for `selectWarmupExercises`**

Append to `convex/coach/exerciseSelection.test.ts`:

```typescript
import { selectWarmupExercises, selectCooldownExercises } from "./exerciseSelection";

describe("selectWarmupExercises", () => {
  it("returns movements tagged Warm-up or Mobility matching target muscles", () => {
    const catalog: Movement[] = [
      movement({
        id: "warmup1",
        name: "Chest Opener",
        muscleGroups: ["Chest"],
        skillLevel: 1,
        trainingTypes: ["Warm-up"],
      }),
      movement({
        id: "mobility1",
        name: "Shoulder Mobility",
        muscleGroups: ["Shoulders"],
        skillLevel: 1,
        trainingTypes: ["Mobility"],
      }),
      movement({
        id: "strength1",
        name: "Bench Press",
        muscleGroups: ["Chest", "Triceps"],
        skillLevel: 1,
        trainingTypes: ["Strength"],
      }),
      movement({ id: "untagged", name: "Cable Fly", muscleGroups: ["Chest"], skillLevel: 1 }),
    ];

    const result = selectWarmupExercises({
      catalog,
      targetMuscleGroups: ["Chest", "Shoulders"],
      maxExercises: 3,
    });

    expect(result).toHaveLength(2);
    expect(result).toContain("warmup1");
    expect(result).toContain("mobility1");
    expect(result).not.toContain("strength1");
    expect(result).not.toContain("untagged");
  });

  it("falls back to Recovery and Yoga when primary tags have no matches", () => {
    const catalog: Movement[] = [
      movement({
        id: "recovery1",
        name: "Light Stretch",
        muscleGroups: ["Chest"],
        skillLevel: 1,
        trainingTypes: ["Recovery"],
      }),
      movement({
        id: "yoga1",
        name: "Chest Yoga",
        muscleGroups: ["Chest"],
        skillLevel: 1,
        trainingTypes: ["Yoga"],
      }),
    ];

    const result = selectWarmupExercises({
      catalog,
      targetMuscleGroups: ["Chest"],
      maxExercises: 3,
    });

    expect(result).toContain("recovery1");
    expect(result).toContain("yoga1");
  });

  it("returns empty array when no movements match any fallback type", () => {
    const catalog: Movement[] = [
      movement({
        id: "s1",
        name: "Bench Press",
        muscleGroups: ["Chest"],
        skillLevel: 1,
        trainingTypes: ["Strength"],
      }),
    ];

    const result = selectWarmupExercises({
      catalog,
      targetMuscleGroups: ["Chest"],
      maxExercises: 3,
    });

    expect(result).toEqual([]);
  });

  it("respects excludeAccessories constraint", () => {
    const catalog: Movement[] = [
      movement({
        id: "warmup-bar",
        name: "Bar Mobility",
        muscleGroups: ["Chest"],
        skillLevel: 1,
        trainingTypes: ["Warm-up"],
        onMachineInfo: {
          accessory: "Smart Bar",
          resistanceType: "",
          spotterDisabled: false,
          eccentricDisabled: false,
          chainsDisabled: false,
          burnoutDisabled: false,
        },
      }),
      movement({
        id: "warmup-none",
        name: "Chest Opener",
        muscleGroups: ["Chest"],
        skillLevel: 1,
        trainingTypes: ["Warm-up"],
      }),
    ];

    const result = selectWarmupExercises({
      catalog,
      targetMuscleGroups: ["Chest"],
      maxExercises: 3,
      constraints: { excludeAccessories: ["Smart Bar"] },
    });

    expect(result).toEqual(["warmup-none"]);
  });

  it("does not filter by skill level", () => {
    const catalog: Movement[] = [
      movement({
        id: "advanced-warmup",
        name: "Advanced Mobility",
        muscleGroups: ["Chest"],
        skillLevel: 5,
        trainingTypes: ["Warm-up"],
      }),
    ];

    const result = selectWarmupExercises({
      catalog,
      targetMuscleGroups: ["Chest"],
      maxExercises: 3,
    });

    expect(result).toEqual(["advanced-warmup"]);
  });
});

describe("selectCooldownExercises", () => {
  it("returns movements tagged Recovery or Mobility matching target muscles", () => {
    const catalog: Movement[] = [
      movement({
        id: "recovery1",
        name: "Light Stretch",
        muscleGroups: ["Chest"],
        skillLevel: 1,
        trainingTypes: ["Recovery"],
      }),
      movement({
        id: "mobility1",
        name: "Chest Mobility",
        muscleGroups: ["Chest"],
        skillLevel: 1,
        trainingTypes: ["Mobility"],
      }),
      movement({
        id: "warmup1",
        name: "Chest Opener",
        muscleGroups: ["Chest"],
        skillLevel: 1,
        trainingTypes: ["Warm-up"],
      }),
    ];

    const result = selectCooldownExercises({
      catalog,
      targetMuscleGroups: ["Chest"],
      maxExercises: 2,
    });

    expect(result).toContain("recovery1");
    expect(result).toContain("mobility1");
    expect(result).not.toContain("warmup1");
  });

  it("falls back to Yoga when primary tags have no matches", () => {
    const catalog: Movement[] = [
      movement({
        id: "yoga1",
        name: "Chest Yoga",
        muscleGroups: ["Chest"],
        skillLevel: 1,
        trainingTypes: ["Yoga"],
      }),
    ];

    const result = selectCooldownExercises({
      catalog,
      targetMuscleGroups: ["Chest"],
      maxExercises: 2,
    });

    expect(result).toEqual(["yoga1"]);
  });

  it("returns empty when no matching movements exist", () => {
    const result = selectCooldownExercises({
      catalog: [],
      targetMuscleGroups: ["Chest"],
      maxExercises: 2,
    });
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run convex/coach/exerciseSelection.test.ts`
Expected: FAIL — `selectWarmupExercises` and `selectCooldownExercises` not exported

- [ ] **Step 3: Implement warmup and cooldown selection**

Add to `convex/coach/exerciseSelection.ts` after the existing `selectExercises` function:

```typescript
export interface WarmupCooldownInput {
  catalog: Movement[];
  targetMuscleGroups: string[];
  maxExercises: number;
  constraints?: {
    excludeAccessories?: string[];
  };
}

/**
 * Select warmup exercises: movements tagged "Warm-up" or "Mobility" matching
 * target muscles. Falls back to "Recovery" then "Yoga" if insufficient matches.
 * No skill level filtering. No rotation logic.
 */
export function selectWarmupExercises(input: WarmupCooldownInput): string[] {
  return selectByTrainingType(input, [
    ["Warm-up", "Mobility"],
    ["Recovery", "Yoga"],
  ]);
}

/**
 * Select cooldown exercises: movements tagged "Recovery" or "Mobility" matching
 * target muscles. Falls back to "Yoga" if insufficient matches.
 */
export function selectCooldownExercises(input: WarmupCooldownInput): string[] {
  return selectByTrainingType(input, [["Recovery", "Mobility"], ["Yoga"]]);
}

/** Shared selection logic with fallback chain of training type groups. */
function selectByTrainingType(input: WarmupCooldownInput, fallbackChain: string[][]): string[] {
  const { catalog, targetMuscleGroups, maxExercises, constraints } = input;
  const targetSet = new Set(targetMuscleGroups.map((g) => g.toLowerCase()));
  const excludeAccessorySet = new Set(constraints?.excludeAccessories ?? []);

  const eligible = catalog.filter((m) => {
    if (!m.trainingTypes?.length) return false;
    if (!m.muscleGroups.some((g) => targetSet.has(g.toLowerCase()))) return false;
    if (excludeAccessorySet.size > 0 && m.onMachineInfo?.accessory) {
      if (excludeAccessorySet.has(m.onMachineInfo.accessory)) return false;
    }
    return true;
  });

  // Try each fallback group in order, accumulating results
  const selected: string[] = [];
  const usedIds = new Set<string>();

  for (const typeGroup of fallbackChain) {
    if (selected.length >= maxExercises) break;
    const typeSet = new Set(typeGroup.map((t) => t.toLowerCase()));
    const matches = eligible.filter(
      (m) => !usedIds.has(m.id) && m.trainingTypes!.some((t) => typeSet.has(t.toLowerCase())),
    );
    for (const m of matches) {
      if (selected.length >= maxExercises) break;
      selected.push(m.id);
      usedIds.add(m.id);
    }
  }

  return selected;
}
```

- [ ] **Step 4: Update `movementDefaults` in test file for `trainingTypes` compatibility**

The test helper `movement()` in `exerciseSelection.test.ts` needs to accept `trainingTypes`. Since the `Movement` interface now has `trainingTypes?: string[]`, the existing `movementDefaults` doesn't need changes (it's optional), but the `movement()` factory's `overrides` type needs to accept it. Since `overrides` is `Partial<Movement>`, it already accepts `trainingTypes`. No code change needed.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run convex/coach/exerciseSelection.test.ts`
Expected: All tests PASS (existing + new)

- [ ] **Step 6: Commit**

```bash
git add convex/coach/exerciseSelection.ts convex/coach/exerciseSelection.test.ts
git commit -m "feat: add warmup and cooldown exercise selection with fallback chain"
```

---

## Task 5: Integrate warmup/cooldown into weekly programming

**Files:**

- Modify: `convex/coach/weekProgrammingHelpers.ts`
- Modify: `convex/coach/weekProgramming.ts`

- [ ] **Step 1: Add warmup/cooldown constants and block builder to helpers**

In `convex/coach/weekProgrammingHelpers.ts`, add after the `DEFAULT_REPS` constant (line 42):

```typescript
/** Warmup/cooldown exercise counts per duration tier. */
export const WARMUP_COOLDOWN_COUNTS: Record<number, { warmup: number; cooldown: number }> = {
  30: { warmup: 1, cooldown: 1 },
  45: { warmup: 2, cooldown: 1 },
  60: { warmup: 2, cooldown: 2 },
};

export const DEFAULT_WARMUP_COOLDOWN = { warmup: 2, cooldown: 1 };

/** Warmup block rep scheme (higher reps, lighter weight). */
export const WARMUP_REPS = 15;
export const WARMUP_SETS = 2;

/** Cooldown block rep scheme. */
export const COOLDOWN_REPS = 12;
export const COOLDOWN_SETS = 2;
```

Add a function to build warmup/cooldown blocks. After `blocksFromMovementIds` (line 180):

```typescript
/**
 * Build a warmup block from movement IDs. Each exercise gets warmUp: true flag
 * and higher reps (lighter weight activation).
 */
export function warmupBlockFromMovementIds(
  movementIds: string[],
  options?: { catalog?: { id: string; countReps: boolean }[] },
): BlockInput[] {
  if (movementIds.length === 0) return [];
  const catalogMap = new Map((options?.catalog ?? []).map((m) => [m.id, m]));
  return [
    {
      exercises: movementIds.map((movementId) => {
        const movement = catalogMap.get(movementId);
        const isDurationBased = movement ? !movement.countReps : false;
        if (isDurationBased) {
          return {
            movementId,
            sets: WARMUP_SETS,
            duration: DEFAULT_DURATION_SECONDS,
            warmUp: true,
          };
        }
        return { movementId, sets: WARMUP_SETS, reps: WARMUP_REPS, warmUp: true };
      }),
    },
  ];
}

/**
 * Build a cooldown block from movement IDs. Lower sets, moderate reps, no warmUp flag.
 */
export function cooldownBlockFromMovementIds(
  movementIds: string[],
  options?: { catalog?: { id: string; countReps: boolean }[] },
): BlockInput[] {
  if (movementIds.length === 0) return [];
  const catalogMap = new Map((options?.catalog ?? []).map((m) => [m.id, m]));
  return [
    {
      exercises: movementIds.map((movementId) => {
        const movement = catalogMap.get(movementId);
        const isDurationBased = movement ? !movement.countReps : false;
        if (isDurationBased) {
          return { movementId, sets: COOLDOWN_SETS, duration: DEFAULT_DURATION_SECONDS };
        }
        return { movementId, sets: COOLDOWN_SETS, reps: COOLDOWN_REPS };
      }),
    },
  ];
}
```

Note: `DEFAULT_DURATION_SECONDS` is already defined at line 143 of this file. Move its declaration before `blocksFromMovementIds` if it's currently inside it, or ensure it's accessible.

- [ ] **Step 2: Import and use warmup/cooldown in `weekProgramming.ts`**

In `convex/coach/weekProgramming.ts`, add imports:

```typescript
import { selectWarmupExercises, selectCooldownExercises } from "./exerciseSelection";
import {
  // ... existing imports ...
  WARMUP_COOLDOWN_COUNTS,
  DEFAULT_WARMUP_COOLDOWN,
  warmupBlockFromMovementIds,
  cooldownBlockFromMovementIds,
} from "./weekProgrammingHelpers";
```

In the `generateDraftWeekPlan` handler, after `movementIds` are selected (around line 165), add warmup/cooldown selection and modify the block construction:

```typescript
// After line 165 (if movementIds.length === 0) continue;

// Select warmup and cooldown exercises
const wcCounts = WARMUP_COOLDOWN_COUNTS[sessionDurationMinutes] ?? DEFAULT_WARMUP_COOLDOWN;
const warmupIds = selectWarmupExercises({
  catalog,
  targetMuscleGroups,
  maxExercises: wcCounts.warmup,
  constraints: { excludeAccessories: data.constraints?.excludeAccessories },
});
const cooldownIds = selectCooldownExercises({
  catalog,
  targetMuscleGroups,
  maxExercises: wcCounts.cooldown,
  constraints: { excludeAccessories: data.constraints?.excludeAccessories },
});
```

Then change the block construction (line 184) to include warmup/cooldown blocks:

```typescript
const warmupBlocks = warmupBlockFromMovementIds(warmupIds, { catalog });
const mainBlocks = blocksFromMovementIds(movementIds, suggestions, { catalog });
const cooldownBlocks = cooldownBlockFromMovementIds(cooldownIds, { catalog });
const blocks = [...warmupBlocks, ...mainBlocks, ...cooldownBlocks];
```

Adjust `maxExercises` for the main block to account for warmup/cooldown (before the `selectExercises` call, around line 158):

```typescript
const mainMaxExercises = maxExercises - wcCounts.warmup - wcCounts.cooldown;
```

Then pass `mainMaxExercises` instead of `maxExercises` to `selectExercises`.

- [ ] **Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Run existing tests**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add convex/coach/weekProgrammingHelpers.ts convex/coach/weekProgramming.ts
git commit -m "feat: integrate automatic warmup and cooldown blocks into weekly programming"
```

---

## Task 6: Update AI coach tools and system prompt

**Files:**

- Modify: `convex/ai/tools.ts`
- Modify: `convex/ai/coach.ts`
- Modify: `convex/mcp/tools/exercises.ts`

- [ ] **Step 1: Add `trainingType` filter to `searchExercisesTool`**

In `convex/ai/tools.ts`, add `trainingType` to the input schema of `searchExercisesTool` (after line 27):

```typescript
    trainingType: z
      .string()
      .optional()
      .describe("Filter by training type: Warm-up, Mobility, Recovery, Yoga, Strength, etc."),
```

Add filter logic after the `muscleGroup` filter (after line 39):

```typescript
if (input.trainingType) {
  const t = input.trainingType.toLowerCase();
  results = results.filter((m) => m.trainingTypes?.some((tt) => tt.toLowerCase() === t));
}
```

Add `trainingTypes` to the response (line 46):

```typescript
      trainingTypes: m.trainingTypes ?? [],
```

- [ ] **Step 2: Update coach system prompt**

In `convex/ai/coach.ts`, replace the WARM-UP & COOL-DOWN section (lines 139-145) with:

```
WARM-UP & COOL-DOWN:
- Every workout you program automatically includes a warm-up block (first block, warmUp flag = true, 50% weight)
  and a cool-down block (last block, light mobility/recovery movements).
- Warm-up movements are selected from Tonal's curated warm-up and mobility exercises, matched to the session's target muscles.
- Cool-down movements are selected from recovery and mobility exercises for the trained muscles.
- When discussing the workout with the user, explain what the warmup and cooldown movements are and why they were selected.
- If the user asks to skip warmup or cooldown, you can remove those exercises, but advise against it — proper warm-up prevents injury and cool-down aids recovery.
- For leg days, prioritize hip and ankle mobility in the warm-up.
- For upper body days, prioritize shoulder mobility in the warm-up.
```

- [ ] **Step 3: Add `trainingType` to MCP exercise tools**

In `convex/mcp/tools/exercises.ts`, update `listMovements` response (line 14-21) to include `trainingTypes`:

```typescript
    trainingTypes: m.trainingTypes ?? [],
```

Update `searchMovements` to accept and filter by `trainingType`. Add to the function body (after line 47):

```typescript
const trainingType = args.trainingType as string | undefined;
if (trainingType) {
  const t = trainingType.toLowerCase();
  movements = movements.filter((m) => m.trainingTypes?.some((tt) => tt.toLowerCase() === t));
}
```

Add `trainingTypes` to the response mapping (line 55):

```typescript
    trainingTypes: m.trainingTypes ?? [],
```

Update `search_movements` tool definition (line 112-131) to include `trainingType` parameter:

```typescript
        trainingType: {
          type: "string",
          description: "Filter by training type: Warm-up, Mobility, Recovery, Yoga, Strength, etc.",
        },
```

- [ ] **Step 4: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add convex/ai/tools.ts convex/ai/coach.ts convex/mcp/tools/exercises.ts
git commit -m "feat: add training type filter to exercise search and update coach instructions"
```

---

## Task 7: Final verification

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Review total diff**

Run: `git diff main --stat`
Verify: All expected files appear, no unexpected files
