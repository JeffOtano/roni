import { describe, expect, it, vi } from "vitest";
import type { Id } from "../_generated/dataModel";
import { finalizeSuccessfulBackfill } from "./backfillCompletion";
import {
  BACKFILL_BATCH_SIZE,
  BACKFILL_CONTINUATION_DELAY_MS,
  BACKFILL_MAX_RETRIES,
  backfillUserHistoryWithDeps,
} from "./backfillRunner";
import type { Activity } from "./types";

const USER_ID = "user_123" as Id<"users">;

function buildActivity(activityId: string, activityTime: string): Activity {
  return {
    activityId,
    userId: "tonal-user-1",
    activityTime,
    activityType: "workout",
    workoutPreview: {
      activityId,
      workoutId: `workout-${activityId}`,
      workoutTitle: `Workout ${activityId}`,
      programName: "12 Weeks to Unleash",
      coachName: "Coach",
      level: "advanced",
      targetArea: "Upper Body",
      isGuidedWorkout: true,
      workoutType: "WEIGHTS",
      beginTime: activityTime,
      totalDuration: 1800,
      totalVolume: 5000,
      totalWork: 1000,
      totalAchievements: 0,
      activityType: "workout",
    },
  };
}

describe("backfillUserHistoryWithDeps", () => {
  it("completes the backfill when enrichment partially fails", async () => {
    const syncStatusWrites: string[] = [];
    const setSyncingStatus = vi.fn(async () => {
      syncStatusWrites.push("syncing");
    });
    const fetchWorkoutHistoryPage = vi.fn().mockResolvedValue({
      activities: [
        buildActivity("a1", "2026-04-13T08:00:00Z"),
        buildActivity("a2", "2026-04-14T08:00:00Z"),
      ],
      pageSize: 2,
      pgTotal: 2,
    });
    const syncActivitiesAndStrength = vi.fn().mockResolvedValue({
      synced: 2,
      remaining: 0,
    });
    const scheduleBackfill = vi.fn().mockResolvedValue(undefined);
    const updateLastSyncedActivityDate = vi.fn().mockResolvedValue(undefined);
    const syncStrengthOnly = vi.fn().mockResolvedValue(undefined);
    const persistNewTableData = vi.fn().mockResolvedValue(3);
    const maybeRefreshProfile = vi.fn().mockResolvedValue(undefined);
    const updateSyncStatus = vi.fn(async ({ syncStatus }: { syncStatus: "complete" }) => {
      syncStatusWrites.push(syncStatus);
    });
    const captureHistorySyncCompleted = vi.fn();
    const flushAnalytics = vi.fn().mockResolvedValue(undefined);
    const logWarning = vi.fn();
    const markFailed = vi.fn().mockResolvedValue(undefined);
    const notifyBackfillFailed = vi.fn().mockResolvedValue(undefined);
    const logInfo = vi.fn();
    const logError = vi.fn();

    const result = await backfillUserHistoryWithDeps(
      {
        userId: USER_ID,
      },
      {
        setSyncingStatus,
        fetchWorkoutHistoryPage,
        syncActivitiesAndStrength,
        scheduleBackfill,
        finalizeSuccessfulBackfill: (args) =>
          finalizeSuccessfulBackfill(args, {
            updateLastSyncedActivityDate,
            syncStrengthOnly,
            persistNewTableData,
            maybeRefreshProfile,
            updateSyncStatus,
            captureHistorySyncCompleted,
            flushAnalytics,
            logWarning,
          }),
        markFailed,
        notifyBackfillFailed,
        logInfo,
        logError,
      },
    );

    expect(result).toEqual({ newWorkouts: 2, totalActivities: 2 });
    expect(setSyncingStatus).toHaveBeenCalledOnce();
    expect(fetchWorkoutHistoryPage).toHaveBeenCalledWith({ userId: USER_ID, offset: 0 });
    expect(syncActivitiesAndStrength).toHaveBeenCalledWith(
      [buildActivity("a1", "2026-04-13T08:00:00Z"), buildActivity("a2", "2026-04-14T08:00:00Z")],
      BACKFILL_BATCH_SIZE,
    );
    expect(updateLastSyncedActivityDate).toHaveBeenCalledWith({
      userId: USER_ID,
      date: "2026-04-14",
    });
    expect(logWarning).toHaveBeenCalledWith(
      `[historySync] Backfill enrichment completed with 3 failure(s) for user ${USER_ID}`,
    );
    expect(syncStatusWrites).toEqual(["syncing", "complete"]);
    expect(captureHistorySyncCompleted).toHaveBeenCalledWith({
      new_workouts: 2,
      backfill: true,
      enrichment_failures: 3,
    });
    expect(scheduleBackfill).not.toHaveBeenCalled();
    expect(markFailed).not.toHaveBeenCalled();
    expect(notifyBackfillFailed).not.toHaveBeenCalled();
    expect(logError).not.toHaveBeenCalled();
  });

  it("schedules a continuation when the current page still has remaining workouts", async () => {
    const setSyncingStatus = vi.fn().mockResolvedValue(undefined);
    const fetchWorkoutHistoryPage = vi.fn().mockResolvedValue({
      activities: [buildActivity("a1", "2026-04-14T08:00:00Z")],
      pageSize: 200,
      pgTotal: 200,
    });
    const syncActivitiesAndStrength = vi.fn().mockResolvedValue({
      synced: 20,
      remaining: 4,
    });
    const scheduleBackfill = vi.fn().mockResolvedValue(undefined);
    const finalizeBackfill = vi.fn().mockResolvedValue(undefined);
    const markFailed = vi.fn().mockResolvedValue(undefined);
    const notifyBackfillFailed = vi.fn().mockResolvedValue(undefined);

    const result = await backfillUserHistoryWithDeps(
      {
        userId: USER_ID,
      },
      {
        setSyncingStatus,
        fetchWorkoutHistoryPage,
        syncActivitiesAndStrength,
        scheduleBackfill,
        finalizeSuccessfulBackfill: finalizeBackfill,
        markFailed,
        notifyBackfillFailed,
      },
    );

    expect(result).toEqual({ newWorkouts: 20, totalActivities: 200 });
    expect(scheduleBackfill).toHaveBeenCalledWith(BACKFILL_CONTINUATION_DELAY_MS, {
      userId: USER_ID,
      retryCount: 0,
      pgOffset: 0,
      newestActivityDate: "2026-04-14",
    });
    expect(finalizeBackfill).not.toHaveBeenCalled();
    expect(markFailed).not.toHaveBeenCalled();
    expect(notifyBackfillFailed).not.toHaveBeenCalled();
  });

  it("marks the sync failed and swallows notification errors after the last retry", async () => {
    const fetchError = new Error("Tonal unavailable");
    const notifyError = new Error("Discord unavailable");
    const setSyncingStatus = vi.fn().mockResolvedValue(undefined);
    const fetchWorkoutHistoryPage = vi.fn().mockRejectedValue(fetchError);
    const syncActivitiesAndStrength = vi.fn().mockResolvedValue({
      synced: 0,
      remaining: 0,
    });
    const scheduleBackfill = vi.fn().mockResolvedValue(undefined);
    const finalizeBackfill = vi.fn().mockResolvedValue(undefined);
    const markFailed = vi.fn().mockResolvedValue(undefined);
    const notifyBackfillFailed = vi.fn().mockRejectedValue(notifyError);
    const logError = vi.fn();

    const result = await backfillUserHistoryWithDeps(
      {
        userId: USER_ID,
        retryCount: BACKFILL_MAX_RETRIES,
      },
      {
        setSyncingStatus,
        fetchWorkoutHistoryPage,
        syncActivitiesAndStrength,
        scheduleBackfill,
        finalizeSuccessfulBackfill: finalizeBackfill,
        markFailed,
        notifyBackfillFailed,
        logError,
      },
    );

    await Promise.resolve();

    expect(result).toEqual({ newWorkouts: 0, totalActivities: 0 });
    expect(setSyncingStatus).not.toHaveBeenCalled();
    expect(scheduleBackfill).not.toHaveBeenCalled();
    expect(finalizeBackfill).not.toHaveBeenCalled();
    expect(markFailed).toHaveBeenCalledOnce();
    expect(notifyBackfillFailed).toHaveBeenCalledWith(
      `Backfill failed after ${BACKFILL_MAX_RETRIES + 1} attempts for user ${USER_ID}: ${fetchError.message}`,
    );
    expect(logError).toHaveBeenNthCalledWith(
      1,
      `[historySync] Backfill failed (attempt ${BACKFILL_MAX_RETRIES + 1})`,
      fetchError,
    );
    expect(logError).toHaveBeenNthCalledWith(
      2,
      "[historySync] Backfill failure notification failed",
      notifyError,
    );
  });
});
