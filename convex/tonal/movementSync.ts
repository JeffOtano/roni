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

/** Fetch movements from Tonal API and upsert into the movements table. */
export const syncMovementCatalog = internalAction({
  args: { retryCount: v.optional(v.number()) },
  handler: async (ctx, { retryCount = 0 }) => {
    const MAX_RETRIES = 2;
    const RETRY_DELAY_MS = 10 * 60 * 1000; // 10 minutes
    try {
      // Pick any user with a valid Tonal token (movements are global)
      const tokenUser = await ctx.runQuery(internal.userProfiles.getUserWithValidToken);

      if (!tokenUser) {
        console.warn("[movementSync] No connected users found - skipping catalog sync");
        return;
      }

      const movements = await withTokenRetry(ctx, tokenUser.userId, (token) =>
        tonalFetch<Movement[]>(token, "/v6/movements"),
      );
      const now = Date.now();

      let inserted = 0;
      let updated = 0;
      const unmappedAccessories = new Set<string>();

      for (const m of movements) {
        const accessory = m.onMachineInfo?.accessory ?? undefined;

        if (accessory && !(accessory in ACCESSORY_MAP)) {
          unmappedAccessories.add(accessory);
        }

        const existing = await ctx.runQuery(internal.tonal.movementSync.getByTonalId, {
          tonalId: m.id,
        });

        const doc = mapApiToDoc(m, now);

        if (existing) {
          await ctx.runMutation(internal.tonal.movementSync.updateMovement, {
            id: existing._id,
            ...doc,
          });
          updated++;
        } else {
          await ctx.runMutation(internal.tonal.movementSync.insertMovement, { ...doc });
          inserted++;
        }
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
    } catch (error) {
      console.error("[movementSync] Catalog sync failed:", error);
      void ctx.runAction(internal.discord.notifyError, {
        source: "movementSync",
        message: `Movement catalog sync failed (attempt ${retryCount + 1}/${MAX_RETRIES + 1}): ${error instanceof Error ? error.message : String(error)}`,
      });
      if (retryCount < MAX_RETRIES) {
        await ctx.scheduler.runAfter(
          RETRY_DELAY_MS,
          internal.tonal.movementSync.syncMovementCatalog,
          { retryCount: retryCount + 1 },
        );
        console.log(`[movementSync] Retry ${retryCount + 1} scheduled in 10 minutes`);
      }
    }
  },
});

/** Look up a single movement by Tonal ID. */
export const getByTonalId = internalQuery({
  args: { tonalId: v.string() },
  handler: async (ctx, { tonalId }) => {
    return ctx.db
      .query("movements")
      .withIndex("by_tonalId", (q) => q.eq("tonalId", tonalId))
      .unique();
  },
});

/** Insert a new movement document. */
export const insertMovement = internalMutation({
  args: movementFields,
  handler: async (ctx, args) => {
    return ctx.db.insert("movements", args);
  },
});

/** Update an existing movement document. */
export const updateMovement = internalMutation({
  args: {
    id: v.id("movements"),
    ...movementFields,
  },
  handler: async (ctx, { id, ...fields }) => {
    await ctx.db.patch(id, fields);
  },
});

/**
 * Return all movements from the dedicated table, mapped to the Movement
 * interface shape (tonalId -> id) for backward compatibility.
 * Resolves thumbnailStorageId to a serving URL when thumbnailMediaUrl is absent.
 */
export const getAllMovements = internalQuery({
  handler: async (ctx): Promise<Movement[]> => {
    const docs = await ctx.db.query("movements").collect();
    const results: Movement[] = [];
    for (const doc of docs) {
      const m = mapDocToMovement(doc);
      if (!m.thumbnailMediaUrl && doc.thumbnailStorageId) {
        m.thumbnailMediaUrl = (await ctx.storage.getUrl(doc.thumbnailStorageId)) ?? undefined;
      }
      results.push(m);
    }
    return results;
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
      if (doc) {
        const m = mapDocToMovement(doc);
        if (!m.thumbnailMediaUrl && doc.thumbnailStorageId) {
          m.thumbnailMediaUrl = (await ctx.storage.getUrl(doc.thumbnailStorageId)) ?? undefined;
        }
        results.push(m);
      }
    }
    return results;
  },
});

/** Save a thumbnail storageId to a movement document. */
export const setThumbnailStorageId = internalMutation({
  args: { id: v.id("movements"), storageId: v.id("_storage") },
  handler: async (ctx, { id, storageId }) => {
    await ctx.db.patch(id, { thumbnailStorageId: storageId });
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

/** Find movements with imageAssetId but no thumbnailMediaUrl and no thumbnailStorageId. */
export const getMovementsMissingThumbnails = internalQuery({
  args: { limit: v.number() },
  handler: async (ctx, { limit }) => {
    const all = await ctx.db.query("movements").collect();
    return all
      .filter((m) => !m.thumbnailMediaUrl && m.imageAssetId && !m.thumbnailStorageId)
      .slice(0, limit)
      .map((m) => ({ _id: m._id, imageAssetId: m.imageAssetId! }));
  },
});
