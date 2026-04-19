/**
 * Personal records subsystem.
 *
 * Two cooperating pieces of derived state, both kept in sync with
 * `exercisePerformance` by the helpers below:
 *
 * 1. `perfByMovement` — an `@convex-dev/aggregate` instance namespaced by
 *    `[userId, movementId]`, sort-keyed by `avgWeightLbs`. Gives us
 *    O(log N) `max` / `count` per movement, used when recomputing the best
 *    after a delete/patch removes the prior winner.
 * 2. `personalRecords` table — a per-(user, movement) projection carrying
 *    the best weight plus the context a UI needs: `achievedActivityId`,
 *    `achievedDate`, `totalSessions`. Single-index scans power the
 *    Personal Records page and the workout-detail PR badges without
 *    touching `exercisePerformance` on the read path.
 *
 * Callers never poke these two stores directly — every `exercisePerformance`
 * mutation routes through `afterInsert` / `afterPatch` / `afterDelete` so
 * the invariants stay local to this file.
 */
import { TableAggregate } from "@convex-dev/aggregate";
import type { Doc, Id } from "./_generated/dataModel";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

/** Namespace: one bucket per (user, movement). */
type PerfNamespace = [Id<"users">, string];

/**
 * SortKey is the tuple `[avgWeightLbs, -_creationTime]` so the aggregate's
 * natural ordering places max weight last (what we want for `at(-1)`) AND
 * breaks ties in favor of the earliest-inserted row. The aggregate compares
 * tuples lexicographically, so within a tied weight the row with the larger
 * `-_creationTime` (= smaller `_creationTime` = earliest insertion) sorts
 * last. Without this, ties would fall back to the Convex `_id` string, which
 * is random and non-chronological.
 */
export const perfByMovement = new TableAggregate<{
  Namespace: PerfNamespace;
  Key: [number, number];
  DataModel: DataModel;
  TableName: "exercisePerformance";
}>(components.perfByMovement, {
  namespace: (doc) => [doc.userId, doc.movementId],
  sortKey: (doc) => [doc.avgWeightLbs ?? 0, -doc._creationTime],
});

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function hasWeight(row: Doc<"exercisePerformance">): boolean {
  return row.avgWeightLbs != null && row.avgWeightLbs > 0;
}

/**
 * Exported for the backfill. Normal writes should go through the `afterInsert`
 * / `afterPatch` / `afterDelete` helpers instead — they call this.
 */
export async function recomputeProjection(
  ctx: MutationCtx,
  userId: Id<"users">,
  movementId: string,
): Promise<void> {
  const namespace: PerfNamespace = [userId, movementId];
  const existing = await ctx.db
    .query("personalRecords")
    .withIndex("by_userId_movementId", (q) => q.eq("userId", userId).eq("movementId", movementId))
    .unique();
  const count = await perfByMovement.count(ctx, { namespace });

  if (count === 0) {
    if (existing) await ctx.db.delete(existing._id);
    return;
  }

  // `at(-1)` returns the row with the largest sortKey tuple, which the
  // sortKey function defines as max weight then earliest insertion.
  const winnerItem = await perfByMovement.at(ctx, -1, { namespace });
  const row = await ctx.db.get(winnerItem.id);
  if (!row || !hasWeight(row)) {
    // Aggregate is ahead of the table (e.g. a row got deleted between the
    // count read and now); the next write will reconcile.
    if (existing) await ctx.db.delete(existing._id);
    return;
  }

  // Prefer the user-local date from `completedWorkouts` over the UTC date
  // stored on `exercisePerformance`. Falls back to the UTC date if the
  // workout row hasn't been written yet (sync order isn't guaranteed).
  const workout = await ctx.db
    .query("completedWorkouts")
    .withIndex("by_userId_activityId", (q) =>
      q.eq("userId", userId).eq("activityId", row.activityId),
    )
    .first();

  const next = {
    userId,
    movementId,
    bestAvgWeightLbs: row.avgWeightLbs!,
    achievedActivityId: row.activityId,
    achievedDate: workout?.date ?? row.date,
    totalSessions: count,
    updatedAt: Date.now(),
  };

  if (existing) {
    await ctx.db.replace(existing._id, next);
  } else {
    await ctx.db.insert("personalRecords", next);
  }
}

// ---------------------------------------------------------------------------
// Write hooks (call these from every exercisePerformance mutation)
// ---------------------------------------------------------------------------

/** Call after `ctx.db.insert("exercisePerformance", ...)` completes. */
export async function afterInsert(
  ctx: MutationCtx,
  row: Doc<"exercisePerformance">,
): Promise<void> {
  if (hasWeight(row)) {
    await perfByMovement.insertIfDoesNotExist(ctx, row);
    await recomputeProjection(ctx, row.userId, row.movementId);
  }
}

/** Call with the pre-patch and post-patch docs around `ctx.db.patch(...)`. */
export async function afterPatch(
  ctx: MutationCtx,
  before: Doc<"exercisePerformance">,
  after: Doc<"exercisePerformance">,
): Promise<void> {
  const beforeHasWeight = hasWeight(before);
  const afterHasWeight = hasWeight(after);

  if (beforeHasWeight && afterHasWeight) {
    await perfByMovement.replace(ctx, before, after);
  } else if (beforeHasWeight) {
    await perfByMovement.deleteIfExists(ctx, before);
  } else if (afterHasWeight) {
    await perfByMovement.insertIfDoesNotExist(ctx, after);
  } else {
    return;
  }

  await recomputeProjection(ctx, after.userId, after.movementId);
}

/** Call with the pre-delete doc before `ctx.db.delete(...)` runs. */
export async function afterDelete(
  ctx: MutationCtx,
  row: Doc<"exercisePerformance">,
): Promise<void> {
  if (hasWeight(row)) {
    await perfByMovement.deleteIfExists(ctx, row);
  }
  await recomputeProjection(ctx, row.userId, row.movementId);
}

/**
 * Clear all projections + aggregate entries for a user (account deletion).
 *
 * Namespaces are derived from BOTH `personalRecords` and `exercisePerformance`
 * because a partial backfill populates the aggregate before the projection
 * rows are reconciled — a user who deletes their account between those two
 * phases would otherwise leave orphaned aggregate entries behind.
 */
export async function clearForUser(
  ctx: MutationCtx,
  userId: Id<"users">,
  batchSize: number,
): Promise<boolean> {
  const [records, perfRows] = await Promise.all([
    ctx.db
      .query("personalRecords")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .take(batchSize),
    ctx.db
      .query("exercisePerformance")
      .withIndex("by_userId_date", (q) => q.eq("userId", userId))
      .take(batchSize),
  ]);

  const movementIds = new Set<string>();
  for (const r of records) movementIds.add(r.movementId);
  for (const r of perfRows) movementIds.add(r.movementId);
  for (const movementId of movementIds) {
    await perfByMovement.clear(ctx, { namespace: [userId, movementId] });
  }
  for (const record of records) {
    await ctx.db.delete(record._id);
  }
  return records.length === batchSize;
}
