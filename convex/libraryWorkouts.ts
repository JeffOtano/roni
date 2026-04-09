import { query } from "./_generated/server";
import { Doc } from "./_generated/dataModel";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    return ctx.db
      .query("libraryWorkouts")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
  },
});

/**
 * Paginated, server-side filtered query for the browse page.
 *
 * Strategy: pick the most selective indexed field (priority order:
 * goal > sessionType > level > durationMinutes), use its dedicated
 * index, and apply remaining filters via .filter(). When no filters
 * are active, does a plain paginated table scan.
 */
export const listFiltered = query({
  args: {
    goal: v.optional(v.string()),
    sessionType: v.optional(v.string()),
    durationMinutes: v.optional(v.number()),
    level: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const { goal, sessionType, durationMinutes, level, paginationOpts } = args;

    // Pick the best index for the primary filter, apply the rest via .filter().
    // Priority order matches rough selectivity: goal > sessionType > level > duration.
    const baseQuery =
      goal !== undefined
        ? ctx.db.query("libraryWorkouts").withIndex("by_goal", (q) => q.eq("goal", goal))
        : sessionType !== undefined
          ? ctx.db
              .query("libraryWorkouts")
              .withIndex("by_sessionType", (q) => q.eq("sessionType", sessionType))
          : level !== undefined
            ? ctx.db.query("libraryWorkouts").withIndex("by_level", (q) => q.eq("level", level))
            : durationMinutes !== undefined
              ? ctx.db
                  .query("libraryWorkouts")
                  .withIndex("by_durationMinutes", (q) => q.eq("durationMinutes", durationMinutes))
              : ctx.db.query("libraryWorkouts");

    // Build remaining filter conditions for fields not covered by the index
    const needsSessionTypeFilter = sessionType !== undefined && goal !== undefined;
    const needsLevelFilter =
      level !== undefined && (goal !== undefined || sessionType !== undefined);
    const needsDurationFilter =
      durationMinutes !== undefined &&
      (goal !== undefined || sessionType !== undefined || level !== undefined);

    const hasRemainingFilters = needsSessionTypeFilter || needsLevelFilter || needsDurationFilter;

    const filtered = hasRemainingFilters
      ? baseQuery.filter((q) => {
          let expr = q.eq(q.field("_id"), q.field("_id")); // always-true seed
          if (needsSessionTypeFilter) expr = q.and(expr, q.eq(q.field("sessionType"), sessionType));
          if (needsLevelFilter) expr = q.and(expr, q.eq(q.field("level"), level));
          if (needsDurationFilter)
            expr = q.and(expr, q.eq(q.field("durationMinutes"), durationMinutes));
          return expr;
        })
      : baseQuery;

    const result = await filtered.paginate(paginationOpts);
    return { ...result, page: result.page.map(projectCardData) };
  },
});

/** Project a full libraryWorkouts document to the card data shape. */
function projectCardData(w: Doc<"libraryWorkouts">) {
  return {
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
  };
}

export const getSlugsPage = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, { paginationOpts }) => {
    const result = await ctx.db.query("libraryWorkouts").paginate(paginationOpts);
    return {
      slugs: result.page.map((w) => w.slug),
      isDone: result.isDone,
      continueCursor: result.continueCursor,
    };
  },
});

const LEVEL_ORDER = ["beginner", "intermediate", "advanced"];
const DURATION_ORDER = [20, 30, 45, 60];

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

    const candidates = sameSession.filter((w) => w.slug !== slug);
    const seen = new Set<string>([slug]);
    const related: typeof candidates = [];

    // Priority 1: Next level up (same session, goal, duration, equipment)
    const nextLevelIdx = LEVEL_ORDER.indexOf(current.level) + 1;
    if (nextLevelIdx < LEVEL_ORDER.length) {
      const progression = candidates.find(
        (w) =>
          w.goal === current.goal &&
          w.durationMinutes === current.durationMinutes &&
          w.equipmentConfig === current.equipmentConfig &&
          w.level === LEVEL_ORDER[nextLevelIdx],
      );
      if (progression && !seen.has(progression.slug)) {
        related.push(progression);
        seen.add(progression.slug);
      }
    }

    // Priority 2: Longer duration (same session, goal, level, equipment)
    const nextDurIdx = DURATION_ORDER.indexOf(current.durationMinutes) + 1;
    if (related.length < limit && nextDurIdx < DURATION_ORDER.length) {
      const longer = candidates.find(
        (w) =>
          w.goal === current.goal &&
          w.level === current.level &&
          w.equipmentConfig === current.equipmentConfig &&
          w.durationMinutes === DURATION_ORDER[nextDurIdx],
      );
      if (longer && !seen.has(longer.slug)) {
        related.push(longer);
        seen.add(longer.slug);
      }
    }

    // Priority 3: Different goal, same session type and level
    for (const w of candidates) {
      if (related.length >= limit) break;
      if (!seen.has(w.slug) && w.goal !== current.goal && w.level === current.level) {
        related.push(w);
        seen.add(w.slug);
      }
    }

    // Priority 4: Fill remaining from same session type
    for (const w of candidates) {
      if (related.length >= limit) break;
      if (!seen.has(w.slug)) {
        related.push(w);
        seen.add(w.slug);
      }
    }

    return related.slice(0, limit).map((w) => ({
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
