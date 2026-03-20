import { internalAction, internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { buildLibraryWorkout, enumerateValidCombos } from "./libraryGeneration";

export const upsertLibraryWorkout = internalMutation({
  args: {
    slug: v.string(),
    data: v.any(),
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

export const generateBatch = internalAction({
  args: {
    sessionTypes: v.array(v.string()),
    generationVersion: v.number(),
  },
  handler: async (ctx, { sessionTypes, generationVersion }) => {
    const catalog = await ctx.runQuery(internal.tonal.movementSync.getAllMovements);

    const combos = enumerateValidCombos().filter((c) => sessionTypes.includes(c.sessionType));

    let created = 0;
    let skipped = 0;
    const recentBySession: Record<string, string[]> = {};

    for (const combo of combos) {
      const recent = recentBySession[combo.sessionType] ?? [];
      const workout = buildLibraryWorkout({ combo, catalog, recentMovementIds: recent });

      if (!workout) {
        skipped++;
        continue;
      }

      workout.generationVersion = generationVersion;

      const ids = workout.movementDetails.map((m) => m.movementId);
      recentBySession[combo.sessionType] = [...recent, ...ids].slice(-30);

      await ctx.runMutation(internal.coach.libraryGenerationActions.upsertLibraryWorkout, {
        slug: workout.slug,
        data: workout,
      });
      created++;
    }

    return { created, skipped, total: combos.length };
  },
});

export const generateAll = internalAction({
  args: { generationVersion: v.number() },
  handler: async (
    ctx,
    { generationVersion },
  ): Promise<Array<{ batch: string[]; created: number; skipped: number; total: number }>> => {
    const sessionTypeBatches = [
      ["push", "pull"],
      ["legs", "upper"],
      ["lower", "full_body"],
      ["chest", "back"],
      ["shoulders", "arms"],
      ["core", "glutes_hamstrings"],
      ["chest_back", "mobility"],
      ["recovery"],
    ];

    const results: Array<{ batch: string[]; created: number; skipped: number; total: number }> = [];
    for (const batch of sessionTypeBatches) {
      const result: { created: number; skipped: number; total: number } = await ctx.runAction(
        internal.coach.libraryGenerationActions.generateBatch,
        { sessionTypes: batch, generationVersion },
      );
      results.push({ batch, ...result });
    }

    return results;
  },
});
