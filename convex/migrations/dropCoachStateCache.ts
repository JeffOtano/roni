/**
 * One-shot data cleanup that prepares the database for the schema narrowing in
 * the same commit:
 *
 * 1. `runDropCoachStateRows` empties the `coachState` table. Post-T2 nothing
 *    reads or writes these rows; the table is dead data. The accompanying
 *    schema drop in this commit removes the table definition entirely. We
 *    can't use `migrations.define({ table: "coachState" })` because the table
 *    is gone from the typed schema — `deleteCoachStateBatch` is a raw mutation
 *    that scans via the dynamic-name escape hatch (same approach as
 *    `repairOrphanedAuthAccounts.ts`).
 *
 *    The action uses the deadline-budget pattern from `dataRetention.ts`:
 *    each invocation deletes batches until either the table is empty or the
 *    action wall-clock budget is exhausted, then returns
 *    `{ complete: false }` so the operator knows to re-invoke. Deletion is
 *    idempotent — an interrupted run resumes correctly because each batch
 *    just `.take()`s the next set of remaining rows.
 *
 * 2. `narrowSnapshotSource` rewrites any `aiRun` row whose `snapshotSource`
 *    is the now-unreachable `coach_state_fresh` / `coach_state_stale` literal
 *    to `live_rebuild`. The narrowed validator in `convex/aiUsage.ts`
 *    (`aiRunArgs`) and `convex/schema.ts` (`aiRun` table) only accepts
 *    `live_rebuild`, so historical rows must be normalized first or schema
 *    validation rejects them.
 *
 *    Backfill choice: every chat turn now produces `live_rebuild` (the cache
 *    is gone). Coercing legacy rows to `live_rebuild` keeps the field
 *    descriptive of "where the snapshot came from" — strictly speaking the
 *    historical rows DID hit a `coachState` cache hit/miss at the time, but
 *    that distinction is no longer meaningful since the cache itself is gone.
 *
 * Run order in production (before deploying the narrowed schema):
 *   npx convex run migrations:run '{"fn": "migrations/dropCoachStateCache:narrowSnapshotSource"}' --prod
 *   # Re-invoke until the response shows `complete: true`:
 *   npx convex run migrations/dropCoachStateCache:runDropCoachStateRows --prod
 *
 * Refs: docs/adr/0001-coach-state-denormalization.md §0 outcome (c).
 */

import { v } from "convex/values";
import { internalAction, internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { migrations } from "../migrations";

const COACH_STATE_DELETE_BATCH = 200;

const ACTION_LIMIT_MS = 600_000;
const SAFETY_BUFFER_MS = 60_000;
/** Wall-clock budget per invocation; exported so tests can override it. */
export const DROP_COACH_STATE_DEADLINE_OFFSET_MS = ACTION_LIMIT_MS - SAFETY_BUFFER_MS;

/**
 * Delete one batch of rows from the dropped `coachState` table. The table is
 * no longer in the typed schema, so the query and delete both go through the
 * `unknown` escape hatch. Returns the number of rows deleted in this batch
 * (zero means the table is empty).
 */
export const deleteCoachStateBatch = internalMutation({
  args: {},
  handler: async (ctx): Promise<number> => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const docs = await (ctx.db as any).query("coachState").take(COACH_STATE_DELETE_BATCH);
    for (const doc of docs as Array<{ _id: string }>) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await ctx.db.delete(doc._id as any);
    }
    return docs.length;
  },
});

/**
 * Drains the `coachState` table in batches, exiting early when the action
 * wall-clock budget is exhausted. Idempotent: re-invoke until the response
 * shows `complete: true`.
 */
export const runDropCoachStateRows = internalAction({
  args: {
    /** Override the deadline budget for tests (omit in production). */
    _deadlineOffsetMs: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ batchesDeleted: number; rowsDeleted: number; complete: boolean }> => {
    const deadline = Date.now() + (args._deadlineOffsetMs ?? DROP_COACH_STATE_DEADLINE_OFFSET_MS);
    let batchesDeleted = 0;
    let rowsDeleted = 0;
    while (true) {
      if (Date.now() >= deadline) {
        return { batchesDeleted, rowsDeleted, complete: false };
      }
      const deleted: number = await ctx.runMutation(
        internal.migrations.dropCoachStateCache.deleteCoachStateBatch,
        {},
      );
      batchesDeleted += 1;
      rowsDeleted += deleted;
      if (deleted < COACH_STATE_DELETE_BATCH) {
        return { batchesDeleted, rowsDeleted, complete: true };
      }
    }
  },
});

// Schema narrowed `aiRun.snapshotSource` to just `"live_rebuild"`. Existing
// rows may still hold the legacy literals; the doc type no longer admits them
// so we read the field through `unknown` and write the patch via `as const` to
// the post-narrowing type.
const LEGACY_SNAPSHOT_SOURCES = new Set(["coach_state_fresh", "coach_state_stale"]);

export const narrowSnapshotSource = migrations.define({
  table: "aiRun",
  migrateOne: (_ctx, doc) => {
    const current = (doc as { snapshotSource?: unknown }).snapshotSource;
    if (typeof current === "string" && LEGACY_SNAPSHOT_SOURCES.has(current)) {
      return { snapshotSource: "live_rebuild" as const };
    }
    return undefined;
  },
});
