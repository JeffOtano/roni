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

const movementFields = {
  tonalId: v.string(),
  name: v.string(),
  shortName: v.string(),
  muscleGroups: v.array(v.string()),
  skillLevel: v.number(),
  publishState: v.string(),
  sortOrder: v.number(),
  onMachine: v.boolean(),
  inFreeLift: v.boolean(),
  countReps: v.boolean(),
  isTwoSided: v.boolean(),
  isBilateral: v.boolean(),
  isAlternating: v.boolean(),
  descriptionHow: v.string(),
  descriptionWhy: v.string(),
  thumbnailMediaUrl: v.optional(v.string()),
  accessory: v.optional(v.string()),
  onMachineInfo: v.optional(v.any()),
  lastSyncedAt: v.number(),
} as const;

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

        const doc = {
          tonalId: m.id,
          name: m.name,
          shortName: m.shortName ?? m.name,
          muscleGroups: m.muscleGroups ?? [],
          skillLevel: m.skillLevel,
          publishState: m.publishState,
          sortOrder: m.sortOrder,
          onMachine: m.onMachine,
          inFreeLift: m.inFreeLift,
          countReps: m.countReps,
          isTwoSided: m.isTwoSided,
          isBilateral: m.isBilateral,
          isAlternating: m.isAlternating,
          descriptionHow: m.descriptionHow,
          descriptionWhy: m.descriptionWhy,
          thumbnailMediaUrl: m.thumbnailMediaUrl,
          accessory,
          onMachineInfo: m.onMachineInfo,
          lastSyncedAt: now,
        };

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
 */
export const getAllMovements = internalQuery({
  handler: async (ctx): Promise<Movement[]> => {
    const docs = await ctx.db.query("movements").collect();
    return docs.map((doc) => ({
      id: doc.tonalId,
      name: doc.name,
      shortName: doc.shortName,
      muscleGroups: doc.muscleGroups,
      skillLevel: doc.skillLevel,
      publishState: doc.publishState,
      sortOrder: doc.sortOrder,
      onMachine: doc.onMachine,
      inFreeLift: doc.inFreeLift,
      countReps: doc.countReps,
      isTwoSided: doc.isTwoSided,
      isBilateral: doc.isBilateral,
      isAlternating: doc.isAlternating,
      descriptionHow: doc.descriptionHow,
      descriptionWhy: doc.descriptionWhy,
      thumbnailMediaUrl: doc.thumbnailMediaUrl,
      onMachineInfo: doc.onMachineInfo,
      trainingTypes: doc.trainingTypes,
    }));
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
        results.push({
          id: doc.tonalId,
          name: doc.name,
          shortName: doc.shortName,
          muscleGroups: doc.muscleGroups,
          skillLevel: doc.skillLevel,
          publishState: doc.publishState,
          sortOrder: doc.sortOrder,
          onMachine: doc.onMachine,
          inFreeLift: doc.inFreeLift,
          countReps: doc.countReps,
          isTwoSided: doc.isTwoSided,
          isBilateral: doc.isBilateral,
          isAlternating: doc.isAlternating,
          descriptionHow: doc.descriptionHow,
          descriptionWhy: doc.descriptionWhy,
          thumbnailMediaUrl: doc.thumbnailMediaUrl,
          onMachineInfo: doc.onMachineInfo,
          trainingTypes: doc.trainingTypes,
        });
      }
    }
    return results;
  },
});
