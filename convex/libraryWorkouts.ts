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

    const sameSession = await ctx.db
      .query("libraryWorkouts")
      .withIndex("by_sessionType", (q) => q.eq("sessionType", current.sessionType))
      .collect();

    const related = sameSession.filter((w) => w.slug !== slug).slice(0, limit);

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
