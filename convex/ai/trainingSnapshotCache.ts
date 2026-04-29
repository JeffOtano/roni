import type { ActionCtx } from "../_generated/server";
import { buildTrainingSnapshot } from "./context";

export type TrainingSnapshotSource = "live_rebuild";

export interface TrainingSnapshotResult {
  snapshot: string;
  source: TrainingSnapshotSource;
  snapshotBuildMs: number;
}

type SnapshotCtx = Pick<ActionCtx, "runQuery">;

export async function getTrainingSnapshotForChat(
  ctx: SnapshotCtx,
  userId: string,
  userTimezone?: string,
): Promise<TrainingSnapshotResult> {
  const startedAt = Date.now();
  const snapshot = await buildTrainingSnapshot(ctx, userId, userTimezone);
  return {
    snapshot,
    source: "live_rebuild",
    snapshotBuildMs: Date.now() - startedAt,
  };
}
