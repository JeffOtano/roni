# Movement Training Type Classification

**Date:** 2026-03-16
**Status:** Approved

## Problem

The AI coach cannot program warmup or cooldown blocks because movements have no category/type classification. The Tonal `/v6/movements` endpoint returns exercises without indicating whether they're strength, mobility, warmup, or recovery movements. The coach can only give verbal suggestions about warmups and cooldowns but cannot structurally include them in programmed workouts.

## Solution

Derive movement training types from Tonal's workout catalog. Workouts have `trainingTypeIds` linking to categories (Strength, Warm-up, Mobility, Recovery, Yoga, etc.) and contain sets with `movementId` references. By analyzing which workouts use which movements, we classify each movement by training type. This classification enables automatic warmup/cooldown block generation in weekly programming.

## Decisions

- **Automatic + coach discretion:** Every programmed workout gets a warmup block prepended and cooldown block appended. Coach can customize via existing swap/remove tools.
- **Workout-derived classification:** Infer movement types from Tonal's curated workout catalog rather than name-pattern heuristics.
- **Tag all training types:** Store all 10 Tonal training types, not just warmup/mobility/recovery. Enables future features (yoga rest-day recommendations, etc.).
- **Direct tagging (Approach 1):** Add `trainingTypes: string[]` to the movements table rather than a junction table or cached blob.

## Design

### 1. Data Model

**Schema changes (`convex/schema.ts`):**

`movements` table — add field:

```
trainingTypes: v.optional(v.array(v.string()))
```

Optional so existing rows remain valid until the first workout catalog sync populates them.

New `trainingTypes` table:

```
{
  tonalId: v.string(),        // Tonal training type UUID
  name: v.string(),           // e.g. "Warm-up", "Mobility", "Recovery"
  description: v.string(),
  lastSyncedAt: v.number(),
}
```

Index: `by_tonalId`. ~10 rows. Stores the training type catalog from `/v6/training-types`.

**Sync timestamp:** Store `lastWorkoutCatalogSyncAt` in the existing `tonalCache` table with `dataType: "workoutCatalogSync"` to track when the workout catalog was last synced.

**Type changes (`convex/tonal/types.ts`):**

Add `trainingTypes?: string[]` to the `Movement` interface.

New types:

```typescript
interface TrainingType {
  id: string;
  name: string;
  description: string;
}

interface TonalWorkoutDetail {
  id: string;
  sets: Array<{ movementId: string }>;
}

interface TonalExploreTile {
  workoutId: string;
  trainingTypeIds: string[];
  publishedAt?: string;
}

interface TonalExploreGroup {
  title: string;
  total: number;
  tiles: TonalExploreTile[];
}
```

### 2. Workout Catalog Sync

**New file: `convex/tonal/workoutCatalogSync.ts`**

Runs as a weekly cron (separate from the daily movement sync).

**API endpoints used:**

- `GET /v6/training-types` — returns the 10 training type definitions with `{id, name, description}`
- `GET /v6/explore/workouts` — returns the curated workout catalog as grouped tiles, each tile with `workoutId` and `trainingTypeIds`. This is the correct endpoint for curated Tonal content (NOT `/v6/workouts`, which returns user-created custom workouts with `trainingTypeIds: null`).
- `GET /v6/workouts/{workoutId}` — returns workout detail with `sets[].movementId`. Works for any workout (curated or custom).

**Flow:**

1. Fetch `GET /v6/training-types` → upsert into `trainingTypes` table → build `Map<typeId, typeName>` (1 API call)
2. Fetch `GET /v6/explore/workouts` → iterate all groups and tiles → collect `{workoutId, trainingTypeIds}` tuples (1 API call, returns grouped tiles with `total` count per group)
3. Filter to workouts not yet processed: compare each tile's `publishedAt` against `lastWorkoutCatalogSyncAt` timestamp (first run processes all since timestamp is 0)
4. For each unprocessed workout, fetch `GET /v6/workouts/{workoutId}` → extract `sets[].movementId` (N API calls, batched 20 concurrent)
5. Build `Map<movementId, Set<trainingTypeName>>` — for each workout, resolve its `trainingTypeIds` to names via the type map, then associate each movementId with those names
6. Write `trainingTypes` array to each movement in the `movements` table via `db.patch` (preserves other fields)
7. Update `lastWorkoutCatalogSyncAt` timestamp

**API volume:**

- First sync: number of curated workouts depends on `/v6/explore/workouts` response (likely 200-500 tiles across all groups). At 20 concurrent with ~200ms/call, ~5 seconds. Note: if the explore endpoint paginates, the sync must iterate pages per group using the `total` field to detect remaining tiles.
- Subsequent syncs: Only workouts published after last sync. Typically 0-10 per week.
- This is a background cron with no user-facing latency.

**Error handling:** If individual workout detail fetches fail, log and skip. Partial classification is better than none. The next weekly sync picks up missed workouts.

**Untagged movements:** Movements that exist in the `/v6/movements` catalog but never appear in any curated workout will have `trainingTypes: undefined`. This is acceptable — the exercise selection engine already handles this gracefully via the fallback chain. Coverage will be monitored during the first sync (log count of tagged vs untagged movements).

### 3. Daily Movement Sync Fix

**Critical change to `convex/tonal/movementSync.ts`:**

The existing `updateMovement` mutation uses `db.replace(id, fields)`, which overwrites the entire document. This would erase `trainingTypes` written by the weekly workout catalog sync because the daily movement sync does not include `trainingTypes` in its field set.

**Fix:** Change `updateMovement` from `db.replace` to `db.patch`:

```typescript
// Before (erases trainingTypes):
await ctx.db.replace(id, fields);

// After (preserves trainingTypes):
await ctx.db.patch(id, fields);
```

This ensures the two sync processes (daily movement sync, weekly workout catalog sync) can coexist without data loss. The `trainingTypes` field is only written by the workout catalog sync.

Additionally, `getAllMovements` and `getByTonalIds` queries must include `trainingTypes: doc.trainingTypes` in their return mapping so downstream consumers (exercise selection, AI tools) can access the classification data.

**New mutation for training type writes:** Add `updateMovementTrainingTypes` mutation in `workoutCatalogSync.ts` (not in `movementSync.ts`) to keep the two syncs independent:

```typescript
updateMovementTrainingTypes(ctx, { tonalId, trainingTypes }) {
  const doc = await ctx.db.query("movements").withIndex("by_tonalId", q => q.eq("tonalId", tonalId)).unique();
  if (doc) await ctx.db.patch(doc._id, { trainingTypes });
}
```

The daily movement sync's `movementFields` and mutations remain untouched.

### 4. Exercise Selection

**New functions in `convex/coach/exerciseSelection.ts`:**

```typescript
selectWarmupExercises(input: {
  catalog: Movement[];
  targetMuscleGroups: string[];
  maxExercises: number;         // typically 2-3
  constraints?: {
    excludeAccessories?: string[];
  };
}): string[]
```

Filters catalog to movements with `trainingTypes` containing `"Warm-up"` or `"Mobility"` that match the session's target muscle groups. Fallback chain if insufficient matches: `"Recovery"` → `"Yoga"`. No skill level filtering — warmup/mobility movements in Tonal's curated catalog are inherently appropriate for all levels. No rotation logic — repeating warmup movements across weeks is acceptable and even desirable for consistency.

```typescript
selectCooldownExercises(input: {
  catalog: Movement[];
  targetMuscleGroups: string[];
  maxExercises: number;         // typically 1-2
  constraints?: {
    excludeAccessories?: string[];
  };
}): string[]
```

Same shape, primary filter for `"Recovery"` or `"Mobility"`, fallback to `"Yoga"`.

**Fallback:** If no movements match the training type + muscle group combination after exhausting the fallback chain, return empty array. The weekly programming layer skips the block rather than inserting inappropriate exercises. The coach can explain the gap if asked.

**Existing `selectExercises()` unchanged.** Training type tags don't affect main working block selection.

### 5. Weekly Programming Integration

**Changes to `convex/coach/weekProgramming.ts`:**

Current flow: `generateDraftWeekPlan` → `selectExercises()` → `blocksFromMovementIds()` → flat blocks.

New flow per session day:

1. Select main exercises as before
2. `selectWarmupExercises()` for session's target muscles → prepend as block 0
3. `selectCooldownExercises()` for session's target muscles → append as final block
4. Warmup exercises get `warmUp: true` flag (Tonal renders at 50% weight)
5. Cooldown exercises: 1-2 sets, 12-15 reps, no `warmUp` flag (inherently light movements)

**Block structure stays flat.** No new "block type" field. Warmup is identified by the `warmUp: true` flag on exercises. Cooldown is identified by position (last block) and rep/set scheme (1-2 sets, 12-15 reps). This is a known limitation — if the coach swaps the last exercise, the cooldown block becomes indistinguishable from a regular block. This is acceptable since the structural purpose (light movement at session end) is preserved by the movement selection itself.

**Duration accounting by tier:**

- 30 min session: 1 warmup + 4 main + 1 cooldown = 6 exercises
- 45 min session: 2 warmup + 5 main + 1 cooldown = 8 exercises
- 60 min session: 2 warmup + 6 main + 2 cooldown = 10 exercises

The warmup/cooldown counts are subtracted from the existing `maxExercises` budget, keeping total duration within the user's preference.

**Deload weeks:** Warmup stays the same. Cooldown slightly longer (+1 mobility movement, taken from the main block budget which is already reduced during deload).

### 6. Coach Instructions & AI Tools

**System prompt (`convex/ai/coach.ts`):**
Replace advisory WARM-UP & COOL-DOWN section with:

- Every programmed workout includes automatic warmup (first block) and cooldown (last block)
- Coach explains movement selection rationale when asked
- If user requests skipping warmup/cooldown, coach can swap/remove but advises against it

**Exercise search tool (`convex/ai/tools.ts`):**
Add optional `trainingType` filter parameter to `searchExercisesTool`. Enables coach to search for mobility exercises in conversation (e.g., "show me hip mobility exercises").

**MCP tools (`convex/mcp/tools/exercises.ts`):**
Add `trainingType` to exercise list/search responses. Add optional `trainingType` filter parameter to search.

**Training snapshot (`convex/ai/context.ts`):**
No changes. Warmup/cooldown is structural in the workout blocks, not contextual.

## Files to Create/Modify

**Create:**

- `convex/tonal/workoutCatalogSync.ts` — workout catalog sync action + training type sync
- `convex/tonal/workoutCatalogSync.test.ts` — sync tests

**Modify:**

- `convex/schema.ts` — add `trainingTypes` field to movements, new `trainingTypes` table
- `convex/tonal/types.ts` — add `trainingTypes` to Movement, new TrainingType/TonalWorkoutDetail types
- `convex/tonal/movementSync.ts` — change `updateMovement` from `db.replace` to `db.patch`; add `trainingTypes` to `getAllMovements` and `getByTonalIds` output mappings
- `convex/coach/exerciseSelection.ts` — new `selectWarmupExercises()` and `selectCooldownExercises()`
- `convex/coach/exerciseSelection.test.ts` — tests for warmup/cooldown selection + fallback behavior
- `convex/coach/weekProgramming.ts` — prepend/append warmup/cooldown blocks, adjust duration accounting
- `convex/coach/weekProgramming.test.ts` — verify warmup/cooldown blocks with correct flags and rep schemes
- `convex/ai/tools.ts` — add `trainingType` filter to search tool
- `convex/ai/coach.ts` — update system prompt warmup/cooldown section
- `convex/mcp/tools/exercises.ts` — add `trainingType` to responses and search filter
- `convex/crons.ts` — add weekly workout catalog sync cron (Sundays at 4 AM UTC, after the daily movement sync at 3 AM)

## Testing

### `convex/tonal/workoutCatalogSync.test.ts`

- Workout with multiple training types tags movement with all types
- Movement appearing in zero curated workouts remains untagged
- Subsequent sync only processes new workouts (timestamp filtering)
- Failed detail fetch is skipped without breaking the sync
- Training type ID→name resolution works correctly

### `convex/coach/exerciseSelection.test.ts`

- `selectWarmupExercises` returns movements tagged "Warm-up" or "Mobility" matching target muscles
- Falls back to "Recovery"/"Yoga" when primary tags have no matches
- Returns empty array when no movements match any fallback type + muscle group
- Equipment constraints (excludeAccessories) are respected
- No skill level filtering applied (all levels included)

### `convex/coach/weekProgramming.test.ts`

- Warmup block prepended with `warmUp: true` flag on exercises
- Cooldown block appended with 1-2 sets, 12-15 reps
- Duration tiers produce correct warmup/main/cooldown split
- Deload week gets extra cooldown movement
- Missing warmup/cooldown candidates results in skipped block (no crash)
