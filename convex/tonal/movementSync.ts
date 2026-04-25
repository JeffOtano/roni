/**
 * Movement catalog sync and query layer.
 *
 * Replaces the cached-blob approach (tonalCache with 24h TTL) with a dedicated
 * `movements` table. A daily cron refreshes the catalog; queries serve all
 * consumers that previously loaded the full blob.
 */

import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import { tonalFetch } from "./client";
import { withTokenRetry } from "./tokenRetry";
import { ACCESSORY_MAP } from "./accessories";
import type { Movement } from "./types";
import * as analytics from "../lib/posthog";
import { mapApiToDoc, mapDocToMovement, movementFields } from "./movementMapping";
import { buildListSearchText } from "./movementSearch";
import { workflow } from "../workflows";

const UPSERT_BATCH_SIZE = 200;

/** Fetch movements from Tonal API and upsert into the movements table. */
export const doSyncMovements = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const movements = await withTokenRetry(ctx, userId, (token) =>
      tonalFetch<Movement[]>(token, "/v6/movements"),
    );
    const now = Date.now();

    const unmappedAccessories = new Set<string>();
    const docs = movements.map((m) => {
      const accessory = m.onMachineInfo?.accessory ?? undefined;
      if (accessory && !(accessory in ACCESSORY_MAP)) {
        unmappedAccessories.add(accessory);
      }
      return mapApiToDoc(m, now);
    });

    let inserted = 0;
    let updated = 0;
    for (let i = 0; i < docs.length; i += UPSERT_BATCH_SIZE) {
      const batch = docs.slice(i, i + UPSERT_BATCH_SIZE);
      const result = await ctx.runMutation(internal.tonal.movementSync.batchUpsertMovements, {
        docs: batch,
      });
      inserted += result.inserted;
      updated += result.updated;
    }

    if (unmappedAccessories.size > 0) {
      console.warn(
        `[movementSync] Unmapped accessory values: ${[...unmappedAccessories].join(", ")}`,
      );
    }

    console.log(
      `[movementSync] Synced ${movements.length} movements (${inserted} inserted, ${updated} updated)`,
    );

    analytics.captureSystem("movement_catalog_synced", {
      count: movements.length,
      inserted,
      updated,
    });
    await analytics.flush();
  },
});

/** Durable workflow: fetch movements from Tonal API and upsert into movements table. */
export const syncMovementCatalogWorkflow = workflow.define({
  args: {},
  handler: async (step): Promise<null> => {
    const tokenUser = await step.runQuery(internal.userProfiles.getUserWithValidToken);
    if (!tokenUser) {
      console.warn("[movementSync] No connected users found - skipping catalog sync");
      return null;
    }

    await step.runAction(internal.tonal.movementSync.doSyncMovements, {
      userId: tokenUser.userId,
    });

    return null;
  },
});

/** Cron entry point: starts the movement catalog sync workflow. */
export const startSyncMovementCatalog = internalMutation({
  args: {},
  handler: async (ctx) => {
    await workflow.start(ctx, internal.tonal.movementSync.syncMovementCatalogWorkflow, {});
  },
});

/** Upsert a batch of movement docs by tonalId in a single transaction. */
export const batchUpsertMovements = internalMutation({
  args: { docs: v.array(v.object(movementFields)) },
  handler: async (ctx, { docs }): Promise<{ inserted: number; updated: number }> => {
    let inserted = 0;
    let updated = 0;
    for (const doc of docs) {
      const existing = await ctx.db
        .query("movements")
        .withIndex("by_tonalId", (q) => q.eq("tonalId", doc.tonalId))
        .unique();
      if (existing) {
        // trainingTypes are derived by workoutCatalogSync, not /v6/movements.
        await ctx.db.patch(existing._id, {
          ...doc,
          ...(existing.trainingTypes !== undefined
            ? {
                trainingTypes: existing.trainingTypes,
                trainingTypesSearchText: buildListSearchText(existing.trainingTypes),
              }
            : {
                trainingTypesSearchText:
                  existing.trainingTypesSearchText ?? doc.trainingTypesSearchText,
              }),
        });
        updated++;
      } else {
        await ctx.db.insert("movements", doc);
        inserted++;
      }
    }
    return { inserted, updated };
  },
});

/**
 * Return all movements from the dedicated table, mapped to the Movement
 * interface shape (tonalId -> id) for backward compatibility.
 * URLs are resolved and persisted at write time by setThumbnailStorageId.
 */
export const getAllMovements = internalQuery({
  handler: async (ctx): Promise<Movement[]> => {
    const docs = await ctx.db.query("movements").collect();
    return docs.map(mapDocToMovement);
  },
});

/** Batch lookup movements by Tonal IDs. */
export const getByTonalIds = internalQuery({
  args: { tonalIds: v.array(v.string()) },
  handler: async (ctx, { tonalIds }): Promise<Movement[]> => {
    const results: Movement[] = [];
    for (const tonalId of tonalIds) {
      const doc = await ctx.db
        .query("movements")
        .withIndex("by_tonalId", (q) => q.eq("tonalId", tonalId))
        .unique();
      if (doc) results.push(mapDocToMovement(doc));
    }
    return results;
  },
});

/** Save a thumbnail storageId and resolved URL to a movement document. */
export const setThumbnailStorageId = internalMutation({
  args: { id: v.id("movements"), storageId: v.id("_storage") },
  handler: async (ctx, { id, storageId }) => {
    const url = await ctx.storage.getUrl(storageId);
    await ctx.db.patch(id, {
      thumbnailStorageId: storageId,
      ...(url ? { thumbnailMediaUrl: url } : {}),
    });
  },
});

/** Fetch and store thumbnail images for movements that lack them. */
export const backfillThumbnails = internalAction({
  args: { batchSize: v.optional(v.number()) },
  handler: async (ctx, { batchSize = 20 }) => {
    const tokenUser = await ctx.runQuery(internal.userProfiles.getUserWithValidToken);
    if (!tokenUser) {
      console.warn("[movementSync] No connected users - skipping thumbnail backfill");
      return;
    }

    const docs = await ctx.runQuery(internal.tonal.movementSync.getMovementsMissingThumbnails, {
      limit: batchSize,
    });

    if (docs.length === 0) {
      console.log("[movementSync] No movements need thumbnail backfill");
      return;
    }

    let stored = 0;
    let failed = 0;

    await withTokenRetry(ctx, tokenUser.userId, async (token: string) => {
      for (const doc of docs) {
        try {
          const res = await fetch(`https://api.tonal.com/v6/assets/${doc.imageAssetId}`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(10_000),
          });

          if (!res.ok) {
            console.warn(`[movementSync] Asset fetch ${doc.imageAssetId} returned ${res.status}`);
            failed++;
            continue;
          }

          const blob = await res.blob();
          const storageId = await ctx.storage.store(blob);
          await ctx.runMutation(internal.tonal.movementSync.setThumbnailStorageId, {
            id: doc._id,
            storageId,
          });
          stored++;
        } catch (e) {
          console.warn(`[movementSync] Failed to fetch asset ${doc.imageAssetId}:`, e);
          failed++;
        }
      }
    });

    console.log(
      `[movementSync] Thumbnail backfill: ${stored} stored, ${failed} failed, ${docs.length - stored - failed} skipped`,
    );

    // Schedule next batch if there might be more
    if (docs.length === batchSize) {
      await ctx.scheduler.runAfter(1000, internal.tonal.movementSync.backfillThumbnails, {
        batchSize,
      });
      console.log("[movementSync] Scheduled next thumbnail backfill batch");
    }
  },
});

// Hard cap on single-pass scans of the movements table. The catalog sits well
// below this today; if it ever grows past, these helpers throw so the caller
// fails loudly instead of silently skipping the overflow rows.
const MOVEMENTS_SCAN_LIMIT = 2000;
const OVERFLOW_ERROR = `movements catalog exceeds MOVEMENTS_SCAN_LIMIT (${MOVEMENTS_SCAN_LIMIT}); switch this helper to a paginated sweep.`;

/** One-time migration: resolve thumbnailStorageId to thumbnailMediaUrl for existing documents. */
export const backfillThumbnailUrls = internalMutation({
  handler: async (ctx) => {
    const docs = await ctx.db.query("movements").take(MOVEMENTS_SCAN_LIMIT + 1);
    if (docs.length > MOVEMENTS_SCAN_LIMIT) throw new Error(OVERFLOW_ERROR);
    const needsBackfill = docs.filter((m) => m.thumbnailStorageId && !m.thumbnailMediaUrl);
    let patched = 0;
    for (const doc of needsBackfill) {
      const url = await ctx.storage.getUrl(doc.thumbnailStorageId!);
      if (url) {
        await ctx.db.patch(doc._id, { thumbnailMediaUrl: url });
        patched++;
      }
    }
    console.log(`[backfillThumbnailUrls] ${patched} of ${needsBackfill.length} documents patched`);
  },
});

/** Find movements with imageAssetId but no thumbnailMediaUrl and no thumbnailStorageId. */
export const getMovementsMissingThumbnails = internalQuery({
  args: { limit: v.number() },
  handler: async (ctx, { limit }) => {
    const all = await ctx.db.query("movements").take(MOVEMENTS_SCAN_LIMIT + 1);
    if (all.length > MOVEMENTS_SCAN_LIMIT) throw new Error(OVERFLOW_ERROR);
    return all
      .filter((m) => !m.thumbnailMediaUrl && m.imageAssetId && !m.thumbnailStorageId)
      .slice(0, limit)
      .map((m) => ({ _id: m._id, imageAssetId: m.imageAssetId! }));
  },
});
