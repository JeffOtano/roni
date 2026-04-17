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
import type { TonalExploreGroup, TonalWorkoutDetail, TrainingType } from "./types";
import * as analytics from "../lib/posthog";
import { workflow } from "../workflows";

const BATCH_SIZE = 20;
const MOVEMENT_UPDATE_BATCH_SIZE = 200;

/**
 * Pure function: build a Map<movementId, trainingTypeName[]> from workout tiles and details.
 * Exported for testing.
 */
export function buildMovementTrainingTypeMap(
  workoutTiles: Array<{ workoutId: string; trainingTypeIds: string[] }>,
  workoutDetails: Map<string, string[]>,
  typeMap: Map<string, string>,
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

/** Patch trainingTypes for a batch of movements by tonalId in one transaction. */
export const batchUpdateMovementTrainingTypes = internalMutation({
  args: {
    updates: v.array(v.object({ tonalId: v.string(), trainingTypes: v.array(v.string()) })),
  },
  handler: async (ctx, { updates }): Promise<{ updated: number; skipped: number }> => {
    let updated = 0;
    let skipped = 0;
    for (const { tonalId, trainingTypes } of updates) {
      const doc = await ctx.db
        .query("movements")
        .withIndex("by_tonalId", (q) => q.eq("tonalId", tonalId))
        .unique();
      if (doc) {
        await ctx.db.patch(doc._id, { trainingTypes });
        updated++;
      } else {
        skipped++;
      }
    }
    return { updated, skipped };
  },
});

/** Get all training types from the table. */
export const getAllTrainingTypes = internalQuery({
  handler: async (ctx) => {
    return ctx.db.query("trainingTypes").collect();
  },
});

/** Core sync logic: fetch training types + workout catalog, tag movements. */
export const doSyncWorkoutCatalog = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await withTokenRetry(ctx, userId, async (token) => {
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

      // 3. Fetch workout details to get movementIds
      const workoutIds = tiles.map((t) => t.workoutId);
      const workoutDetails = await fetchWorkoutDetails(token, workoutIds);
      console.log(
        `[workoutCatalogSync] Fetched details for ${workoutDetails.size}/${workoutIds.length} workouts`,
      );

      // 4. Build movement -> trainingTypes mapping
      const movementTypeMap = buildMovementTrainingTypeMap(tiles, workoutDetails, typeMap);

      // 5. Write trainingTypes to each movement (batched in one transaction per chunk)
      const updates = [...movementTypeMap].map(([tonalId, trainingTypes]) => ({
        tonalId,
        trainingTypes,
      }));
      let updated = 0;
      let skipped = 0;
      for (let i = 0; i < updates.length; i += MOVEMENT_UPDATE_BATCH_SIZE) {
        const batch = updates.slice(i, i + MOVEMENT_UPDATE_BATCH_SIZE);
        const result = await ctx.runMutation(
          internal.tonal.workoutCatalogSync.batchUpdateMovementTrainingTypes,
          { updates: batch },
        );
        updated += result.updated;
        skipped += result.skipped;
      }

      console.log(
        `[workoutCatalogSync] Tagged ${updated} movements with training types (${skipped} skipped — movement not in catalog)`,
      );

      analytics.captureSystem("workout_catalog_synced", {
        movements_tagged: updated,
        movements_skipped: skipped,
      });
    });
    await analytics.flush();
  },
});

/** Durable workflow: sync workout catalog from Tonal API. */
export const syncWorkoutCatalogWorkflow = workflow.define({
  args: {},
  handler: async (step): Promise<null> => {
    const tokenUser = await step.runQuery(internal.userProfiles.getUserWithValidToken);
    if (!tokenUser) {
      console.warn("[workoutCatalogSync] No connected users - skipping");
      return null;
    }

    await step.runAction(internal.tonal.workoutCatalogSync.doSyncWorkoutCatalog, {
      userId: tokenUser.userId,
    });

    return null;
  },
});

/** Cron entry point: starts the workout catalog sync workflow. */
export const startSyncWorkoutCatalog = internalMutation({
  args: {},
  handler: async (ctx) => {
    await workflow.start(ctx, internal.tonal.workoutCatalogSync.syncWorkoutCatalogWorkflow, {});
  },
});
