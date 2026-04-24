import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  type MutationCtx,
  type QueryCtx,
} from "../_generated/server";
import {
  buildListSearchText,
  buildMovementSearchFields,
  matchesNameSearch,
} from "./movementSearch";
import { mapDocToMovement } from "./movementMapping";
import type { Movement } from "./types";

const DEFAULT_SEARCH_LIMIT = 30;
const MAX_SEARCH_LIMIT = 100;
const BACKFILL_BATCH_LIMIT = 200;
const SEARCH_STATE_KEY = "movement_search_fields";
const SEARCH_FIELDS_VERSION = 1;

type MovementDoc = Doc<"movements">;
type SearchIndexKind = "name" | "muscleGroup" | "trainingType";

type MovementSearchFilters = {
  name?: string;
  muscleGroup?: string;
  trainingType?: string;
};

/** Search movements using the narrowest available search index, then exact-filter candidates. */
export const searchMovements = internalQuery({
  args: {
    name: v.optional(v.string()),
    muscleGroup: v.optional(v.string()),
    trainingType: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<Movement[]> => {
    const limit = clampLimit(args.limit);
    const filters = normalizeFilters(args);
    const indexKind = selectIndexKind(filters);

    if (!indexKind) {
      const docs = await ctx.db.query("movements").take(limit);
      return docs.map(mapDocToMovement);
    }

    if (!(await searchFieldsAreReady(ctx))) {
      // Existing catalogs may lack the indexed fields; preserve search results until backfill marks them ready.
      const fallbackMatches = await loadFallbackMatches(ctx, filters, limit);
      return fallbackMatches.map(mapDocToMovement);
    }

    const exactResults = await loadIndexedMatches(ctx, filters, indexKind, limit);
    return exactResults.map(mapDocToMovement);
  },
});

/** One-time migration helper for existing movements created before search fields existed. */
export const backfillMovementSearchFields = internalMutation({
  args: {
    limit: v.optional(v.number()),
    cursor: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ scanned: number; patched: number; hasMore: boolean; cursor: string | null }> => {
    const patchLimit = Math.min(
      BACKFILL_BATCH_LIMIT,
      Math.max(1, args.limit ?? BACKFILL_BATCH_LIMIT),
    );
    const page = await ctx.db.query("movements").paginate({
      numItems: patchLimit,
      cursor: args.cursor ?? null,
    });

    const staleDocs = page.page
      .map((doc) => ({ doc, fields: buildSearchFields(doc) }))
      .filter(({ doc, fields }) => needsPatch(doc, fields));

    let patched = 0;
    for (const { doc, fields } of staleDocs) {
      await ctx.db.patch(doc._id, fields);
      patched++;
    }

    if (page.isDone) {
      await markSearchFieldsReady(ctx);
    }

    return {
      scanned: page.page.length,
      patched,
      hasMore: !page.isDone,
      cursor: page.continueCursor,
    };
  },
});

function normalizeFilters(filters: MovementSearchFilters): MovementSearchFilters {
  return {
    name: normalizeFilter(filters.name),
    muscleGroup: normalizeFilter(filters.muscleGroup),
    trainingType: normalizeFilter(filters.trainingType),
  };
}

function normalizeFilter(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function clampLimit(limit: number | undefined): number {
  if (limit === undefined) return DEFAULT_SEARCH_LIMIT;
  return Math.min(MAX_SEARCH_LIMIT, Math.max(1, Math.floor(limit)));
}

function selectIndexKind(filters: MovementSearchFilters): SearchIndexKind | null {
  const candidates: { kind: SearchIndexKind; value: string; rank: number }[] = [];
  if (filters.name) candidates.push({ kind: "name", value: filters.name, rank: 0 });
  if (filters.muscleGroup) {
    candidates.push({ kind: "muscleGroup", value: filters.muscleGroup, rank: 1 });
  }
  if (filters.trainingType) {
    candidates.push({ kind: "trainingType", value: filters.trainingType, rank: 2 });
  }
  candidates.sort((a, b) => a.value.length - b.value.length || a.rank - b.rank);
  return candidates[0]?.kind ?? null;
}

async function loadIndexedMatches(
  ctx: QueryCtx,
  filters: MovementSearchFilters,
  indexKind: SearchIndexKind,
  limit: number,
): Promise<MovementDoc[]> {
  if (indexKind === "name" && filters.name) {
    return collectMatches(
      ctx.db
        .query("movements")
        .withSearchIndex("search_name", (q) =>
          q.search("nameSearchText", buildListSearchText([filters.name!])),
        ),
      filters,
      limit,
    );
  }

  if (indexKind === "muscleGroup" && filters.muscleGroup) {
    return collectMatches(
      ctx.db
        .query("movements")
        .withSearchIndex("search_muscle_groups", (q) =>
          q.search("muscleGroupsSearchText", buildListSearchText([filters.muscleGroup!])),
        ),
      filters,
      limit,
    );
  }

  if (indexKind === "trainingType" && filters.trainingType) {
    return collectMatches(
      ctx.db
        .query("movements")
        .withSearchIndex("search_training_types", (q) =>
          q.search("trainingTypesSearchText", buildListSearchText([filters.trainingType!])),
        ),
      filters,
      limit,
    );
  }

  return [];
}

async function loadFallbackMatches(
  ctx: QueryCtx,
  filters: MovementSearchFilters,
  limit: number,
): Promise<MovementDoc[]> {
  return collectMatches(ctx.db.query("movements"), filters, limit);
}

async function collectMatches(
  query: AsyncIterable<MovementDoc>,
  filters: MovementSearchFilters,
  limit: number,
): Promise<MovementDoc[]> {
  const matches: MovementDoc[] = [];
  for await (const doc of query) {
    if (matchesFilters(doc, filters)) {
      matches.push(doc);
      if (matches.length >= limit) break;
    }
  }
  return matches;
}

function matchesFilters(doc: MovementDoc, filters: MovementSearchFilters): boolean {
  if (filters.name && !matchesNameSearch(doc, filters.name)) return false;

  if (filters.muscleGroup) {
    const muscleGroup = filters.muscleGroup.toLowerCase();
    if (!doc.muscleGroups.some((candidate) => candidate.toLowerCase() === muscleGroup)) {
      return false;
    }
  }

  if (filters.trainingType) {
    const trainingType = filters.trainingType.toLowerCase();
    if (!doc.trainingTypes?.some((candidate) => candidate.toLowerCase() === trainingType)) {
      return false;
    }
  }

  return true;
}

async function searchFieldsAreReady(ctx: QueryCtx): Promise<boolean> {
  const state = await ctx.db
    .query("movementSearchState")
    .withIndex("by_key", (q) => q.eq("key", SEARCH_STATE_KEY))
    .unique();
  return (state?.version ?? 0) >= SEARCH_FIELDS_VERSION;
}

function buildSearchFields(doc: MovementDoc) {
  return buildMovementSearchFields({
    name: doc.name,
    shortName: doc.shortName,
    descriptionHow: doc.descriptionHow,
    descriptionWhy: doc.descriptionWhy,
    muscleGroups: doc.muscleGroups,
    trainingTypes: doc.trainingTypes,
  });
}

function needsPatch(doc: MovementDoc, fields: ReturnType<typeof buildSearchFields>): boolean {
  return (
    doc.nameSearchText !== fields.nameSearchText ||
    doc.muscleGroupsSearchText !== fields.muscleGroupsSearchText ||
    doc.trainingTypesSearchText !== fields.trainingTypesSearchText
  );
}

async function markSearchFieldsReady(ctx: MutationCtx): Promise<void> {
  const existing = await ctx.db
    .query("movementSearchState")
    .withIndex("by_key", (q) => q.eq("key", SEARCH_STATE_KEY))
    .unique();
  const patch = { version: SEARCH_FIELDS_VERSION, completedAt: Date.now() };
  if (existing) {
    await ctx.db.patch(existing._id, patch);
  } else {
    await ctx.db.insert("movementSearchState", { key: SEARCH_STATE_KEY, ...patch });
  }
}
