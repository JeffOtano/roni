import { internalAction, internalMutation, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { generateText, Output } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { buildLibraryWorkout, enumerateValidCombos } from "./libraryGeneration";
import { generateSlug } from "./goalConfig";
import { blockInputValidator } from "../validators";

const libraryWorkoutValidator = v.object({
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
      phase: v.union(v.literal("warmup"), v.literal("main"), v.literal("cooldown")),
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
  tonalWorkoutId: v.optional(v.string()),
  generationVersion: v.number(),
  createdAt: v.number(),
});

export const slugExists = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const doc = await ctx.db
      .query("libraryWorkouts")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    return doc !== null;
  },
});

export const upsertLibraryWorkout = internalMutation({
  args: {
    slug: v.string(),
    data: libraryWorkoutValidator,
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

export const deleteByVersion = internalMutation({
  args: { generationVersion: v.number() },
  handler: async (ctx, { generationVersion }) => {
    const workouts = await ctx.db
      .query("libraryWorkouts")
      .withIndex("by_generationVersion", (q) => q.eq("generationVersion", generationVersion))
      .take(100);
    for (const w of workouts) {
      await ctx.db.delete(w._id);
    }
    return { deleted: workouts.length, hasMore: workouts.length === 100 };
  },
});

export const generateBatch = internalAction({
  args: {
    sessionTypes: v.array(v.string()),
    generationVersion: v.number(),
    offset: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { sessionTypes, generationVersion, offset = 0, limit = 5 }) => {
    const catalog = await ctx.runQuery(internal.tonal.movementSync.getAllMovements);

    const allCombos = enumerateValidCombos().filter((c) => sessionTypes.includes(c.sessionType));
    const combos = allCombos.slice(offset, offset + limit);

    let created = 0;
    let skipped = 0;
    let existing = 0;

    for (const combo of combos) {
      const slug = generateSlug(combo);
      const exists = await ctx.runQuery(internal.coach.libraryGenerationActions.slugExists, {
        slug,
      });
      if (exists) {
        existing++;
        continue;
      }

      const workout = await buildLibraryWorkout({ combo, catalog, recentMovementIds: [] });

      if (!workout) {
        skipped++;
        continue;
      }

      workout.generationVersion = generationVersion;

      await ctx.runMutation(internal.coach.libraryGenerationActions.upsertLibraryWorkout, {
        slug: workout.slug,
        data: workout,
      });
      created++;
    }

    const hasMore = offset + limit < allCombos.length;
    const nextOffset = hasMore ? offset + limit : null;
    return {
      created,
      skipped,
      existing,
      batch: combos.length,
      total: allCombos.length,
      nextOffset,
      hasMore,
    };
  },
});

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

const descriptionBatchSchema = z.object({
  workouts: z.array(
    z.object({
      slug: z.string(),
      description: z.string(),
      metaDescription: z.string(),
    }),
  ),
});

export const generateDescriptions = internalAction({
  args: { batchSize: v.optional(v.number()) },
  handler: async (ctx, { batchSize = 20 }) => {
    const allWorkouts: Array<{
      slug: string;
      title: string;
      sessionType: string;
      goal: string;
      level: string;
      durationMinutes: number;
      exerciseCount: number;
      targetMuscleGroups: string[];
    }> = await ctx.runQuery(internal.coach.libraryGenerationActions.getWorkoutsNeedingDescriptions);

    const batch = allWorkouts.slice(0, batchSize);
    if (batch.length === 0) return { processed: 0, remaining: 0 };

    const workoutSummaries = batch.map((w) => ({
      slug: w.slug,
      title: w.title,
      sessionType: w.sessionType,
      goal: w.goal,
      level: w.level,
      durationMinutes: w.durationMinutes,
      exerciseCount: w.exerciseCount,
      targetMuscleGroups: w.targetMuscleGroups,
    }));

    const { output } = await generateText({
      model: google("gemini-3-flash-preview"),
      output: Output.object({ schema: descriptionBatchSchema }),
      prompt: `Generate SEO-friendly descriptions for the following strength training workouts.

For each workout, produce:
- description: 2-3 sentences describing the workout, its goals, and what makes it effective. Write in second person ("you"). Be specific about muscle groups, goals, and training level.
- metaDescription: A concise summary under 155 characters for use as an HTML meta description. Include key details like session type, goal, and level.

Workouts:
${JSON.stringify(workoutSummaries, null, 2)}

Return an array of objects with slug, description, and metaDescription for each workout.`,
    });

    for (const item of output.workouts) {
      await ctx.runMutation(internal.coach.libraryGenerationActions.updateDescription, {
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

// ---------------------------------------------------------------------------
// Push library workouts to Tonal via service account
// ---------------------------------------------------------------------------

export const getUnpushedWorkouts = internalQuery({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("libraryWorkouts").collect();
    return all
      .filter((w) => !w.tonalWorkoutId)
      .slice(0, 10)
      .map((w) => ({
        slug: w.slug,
        title: w.title,
        blocks: w.blocks,
        tonalWorkoutId: w.tonalWorkoutId,
      }));
  },
});

export const setTonalWorkoutId = internalMutation({
  args: {
    slug: v.string(),
    tonalWorkoutId: v.string(),
  },
  handler: async (ctx, { slug, tonalWorkoutId }) => {
    const workout = await ctx.db
      .query("libraryWorkouts")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (workout) {
      await ctx.db.patch(workout._id, { tonalWorkoutId });
    }
  },
});

export const pushToTonalBatch = internalAction({
  args: { serviceAccountUserId: v.id("users") },
  handler: async (
    ctx,
    { serviceAccountUserId },
  ): Promise<{ pushed: number; failed: number; remaining: number }> => {
    const unpushed: Array<{
      slug: string;
      title: string;
      blocks: Array<{
        exercises: Array<{
          movementId: string;
          sets: number;
          reps?: number;
          duration?: number;
          warmUp?: boolean;
          spotter?: boolean;
          eccentric?: boolean;
          chains?: boolean;
          burnout?: boolean;
          dropSet?: boolean;
        }>;
      }>;
      tonalWorkoutId?: string;
    }> = await ctx.runQuery(internal.coach.libraryGenerationActions.getUnpushedWorkouts);

    if (unpushed.length === 0) return { pushed: 0, failed: 0, remaining: 0 };

    let pushed = 0;
    let failed = 0;

    for (const workout of unpushed) {
      try {
        const result: { id: string } = await ctx.runAction(
          internal.tonal.mutations.doTonalCreateWorkout,
          {
            userId: serviceAccountUserId,
            title: workout.title,
            blocks: workout.blocks,
          },
        );

        await ctx.runMutation(internal.coach.libraryGenerationActions.setTonalWorkoutId, {
          slug: workout.slug,
          tonalWorkoutId: result.id,
        });
        pushed++;

        // Rate limit: 2 second delay between Tonal API calls
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (e) {
        console.error(`Failed to push ${workout.slug}:`, e);
        failed++;
        if (failed >= 3) break;
      }
    }

    return { pushed, failed, remaining: unpushed.length - pushed - failed };
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
