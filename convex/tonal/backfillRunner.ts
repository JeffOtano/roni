import type { Id } from "../_generated/dataModel";
import type { FinalizeSuccessfulBackfillArgs } from "./backfillCompletion";
import type { Activity } from "./types";

export const BACKFILL_MAX_RETRIES = 3;
export const BACKFILL_RETRY_DELAYS = [30_000, 60_000, 120_000];
export const BACKFILL_BATCH_SIZE = 20;
export const BACKFILL_CONTINUATION_DELAY_MS = 5_000;

export interface BackfillUserHistoryArgs {
  userId: Id<"users">;
  retryCount?: number;
  pgOffset?: number;
  newestActivityDate?: string;
}

interface WorkoutHistoryPage {
  activities: Activity[];
  pageSize: number;
  pgTotal: number;
}

interface ScheduledBackfillArgs {
  userId: Id<"users">;
  retryCount: number;
  pgOffset: number;
  newestActivityDate?: string;
}

interface BackfillUserHistoryDeps {
  setSyncingStatus: () => Promise<unknown>;
  fetchWorkoutHistoryPage: (args: {
    userId: Id<"users">;
    offset: number;
  }) => Promise<WorkoutHistoryPage>;
  syncActivitiesAndStrength: (
    activities: Activity[],
    maxNew: number,
  ) => Promise<{ synced: number; remaining: number }>;
  scheduleBackfill: (delayMs: number, args: ScheduledBackfillArgs) => Promise<unknown>;
  finalizeSuccessfulBackfill: (args: FinalizeSuccessfulBackfillArgs) => Promise<void>;
  markFailed: () => Promise<unknown>;
  notifyBackfillFailed: (message: string) => Promise<unknown> | void;
  logInfo?: (message: string) => void;
  logError?: (message: string, error: unknown) => void;
}

export async function backfillUserHistoryWithDeps(
  args: BackfillUserHistoryArgs,
  deps: BackfillUserHistoryDeps,
): Promise<{ newWorkouts: number; totalActivities: number }> {
  const retryCount = args.retryCount ?? 0;
  const pgOffset = args.pgOffset ?? 0;

  if (retryCount === 0 && pgOffset === 0) {
    await deps.setSyncingStatus();
  }

  try {
    const { activities, pageSize, pgTotal } = await deps.fetchWorkoutHistoryPage({
      userId: args.userId,
      offset: pgOffset,
    });

    const { synced, remaining } =
      activities.length > 0
        ? await deps.syncActivitiesAndStrength(activities, BACKFILL_BATCH_SIZE)
        : { synced: 0, remaining: 0 };

    const pageNewestDate =
      activities.length > 0
        ? activities[activities.length - 1].activityTime.slice(0, 10)
        : undefined;
    const bestDate = pageNewestDate ?? args.newestActivityDate;

    if (remaining > 0) {
      deps.logInfo?.(
        `[historySync] Backfill page offset=${pgOffset}: ${synced} synced, ${remaining} remaining`,
      );
      await deps.scheduleBackfill(BACKFILL_CONTINUATION_DELAY_MS, {
        userId: args.userId,
        retryCount,
        pgOffset,
        newestActivityDate: bestDate,
      });
      return { newWorkouts: synced, totalActivities: pgTotal };
    }

    const nextOffset = pgOffset + pageSize;
    if (nextOffset < pgTotal) {
      deps.logInfo?.(
        `[historySync] Backfill page offset=${pgOffset}: ${synced} synced, advancing to offset=${nextOffset}/${pgTotal}`,
      );
      await deps.scheduleBackfill(BACKFILL_CONTINUATION_DELAY_MS, {
        userId: args.userId,
        retryCount,
        pgOffset: nextOffset,
        newestActivityDate: bestDate,
      });
      return { newWorkouts: synced, totalActivities: pgTotal };
    }

    await deps.finalizeSuccessfulBackfill({
      userId: args.userId,
      newestActivityDate: bestDate,
      newWorkouts: synced,
    });
    deps.logInfo?.(`[historySync] Backfill complete for user ${args.userId} (${pgTotal} total)`);

    return { newWorkouts: synced, totalActivities: pgTotal };
  } catch (err) {
    deps.logError?.(`[historySync] Backfill failed (attempt ${retryCount + 1})`, err);

    if (retryCount < BACKFILL_MAX_RETRIES) {
      const delay = BACKFILL_RETRY_DELAYS[retryCount] ?? 120_000;
      await deps.scheduleBackfill(delay, {
        userId: args.userId,
        retryCount: retryCount + 1,
        pgOffset,
        newestActivityDate: args.newestActivityDate,
      });
      return { newWorkouts: 0, totalActivities: 0 };
    }

    await deps.markFailed();
    const failureMessage = `Backfill failed after ${BACKFILL_MAX_RETRIES + 1} attempts for user ${args.userId}: ${
      err instanceof Error ? err.message : String(err)
    }`;

    try {
      const notifyResult = deps.notifyBackfillFailed(failureMessage);
      void Promise.resolve(notifyResult).catch((notifyErr) => {
        deps.logError?.("[historySync] Backfill failure notification failed", notifyErr);
      });
    } catch (notifyErr) {
      deps.logError?.("[historySync] Backfill failure notification failed", notifyErr);
    }

    return { newWorkouts: 0, totalActivities: 0 };
  }
}
