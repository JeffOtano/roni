import type { ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { buildTrainingSnapshot } from "./context";

export type TrainingSnapshotSource = "coach_state_fresh" | "coach_state_stale" | "live_rebuild";

export interface TrainingSnapshotResult {
  snapshot: string;
  source: TrainingSnapshotSource;
  snapshotBuildMs: number;
}

const COACH_STATE_FRESH_MS = 15 * 60 * 1000;
type SnapshotCtx = Pick<ActionCtx, "runQuery"> & Partial<Pick<ActionCtx, "runMutation">>;

async function scheduleSnapshotRefresh(
  ctx: SnapshotCtx,
  userId: Id<"users">,
  userTimezone: string | undefined,
): Promise<void> {
  if (!ctx.runMutation) return;
  try {
    await ctx.runMutation(internal.coachState.requestRefresh, {
      userId,
      userTimezone,
    });
  } catch {
    // Snapshot refresh is an optimization; live context remains the source of truth.
  }
}

export async function getTrainingSnapshotForChat(
  ctx: SnapshotCtx,
  userId: string,
  userTimezone?: string,
): Promise<TrainingSnapshotResult> {
  const startedAt = Date.now();
  const convexUserId = userId as Id<"users">;
  const state = (await ctx
    .runQuery(internal.coachState.getForUser, { userId: convexUserId })
    .catch(() => null)) as Doc<"coachState"> | null;

  if (state?.snapshot && (state.userTimezone ?? undefined) === userTimezone) {
    const isFresh = Date.now() - state.refreshedAt <= COACH_STATE_FRESH_MS;
    if (!isFresh) await scheduleSnapshotRefresh(ctx, convexUserId, userTimezone);
    return {
      snapshot: state.snapshot,
      source: isFresh ? "coach_state_fresh" : "coach_state_stale",
      snapshotBuildMs: Date.now() - startedAt,
    };
  }

  const snapshot = await buildTrainingSnapshot(ctx, userId, userTimezone);
  await scheduleSnapshotRefresh(ctx, convexUserId, userTimezone);

  return {
    snapshot,
    source: "live_rebuild",
    snapshotBuildMs: Date.now() - startedAt,
  };
}
