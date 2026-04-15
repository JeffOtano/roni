import type { Id } from "../_generated/dataModel";

export interface FinalizeSuccessfulBackfillArgs {
  userId: Id<"users">;
  newestActivityDate?: string;
  newWorkouts: number;
}

export interface HistorySyncCompletedProps extends Record<string, unknown> {
  new_workouts: number;
  backfill: true;
  enrichment_failures: number;
}

interface FinalizeSuccessfulBackfillDeps {
  updateLastSyncedActivityDate: (args: { userId: Id<"users">; date: string }) => Promise<unknown>;
  syncStrengthOnly: () => Promise<void>;
  persistNewTableData: () => Promise<number>;
  maybeRefreshProfile: () => Promise<void>;
  updateSyncStatus: (args: { userId: Id<"users">; syncStatus: "complete" }) => Promise<unknown>;
  captureHistorySyncCompleted: (props: HistorySyncCompletedProps) => void;
  flushAnalytics: () => Promise<void>;
  logWarning?: (message: string) => void;
}

export async function finalizeSuccessfulBackfill(
  args: FinalizeSuccessfulBackfillArgs,
  deps: FinalizeSuccessfulBackfillDeps,
): Promise<void> {
  const { userId, newestActivityDate, newWorkouts } = args;

  if (newestActivityDate) {
    await deps.updateLastSyncedActivityDate({
      userId,
      date: newestActivityDate,
    });
  }

  await deps.syncStrengthOnly();

  const enrichmentFailures = await deps.persistNewTableData();
  if (enrichmentFailures > 0) {
    deps.logWarning?.(
      `[historySync] Backfill enrichment completed with ${enrichmentFailures} failure(s) for user ${userId}`,
    );
  }

  await deps.maybeRefreshProfile();
  await deps.updateSyncStatus({ userId, syncStatus: "complete" });
  deps.captureHistorySyncCompleted({
    new_workouts: newWorkouts,
    backfill: true,
    enrichment_failures: enrichmentFailures,
  });
  await deps.flushAnalytics();
}
