import { describe, expect, it, vi } from "vitest";
import type { Id } from "../_generated/dataModel";
import { finalizeSuccessfulBackfill } from "./backfillCompletion";

const USER_ID = "user_123" as Id<"users">;

describe("finalizeSuccessfulBackfill", () => {
  it("marks sync complete even when enrichment data fails", async () => {
    const updateLastSyncedActivityDate = vi.fn().mockResolvedValue(undefined);
    const syncStrengthOnly = vi.fn().mockResolvedValue(undefined);
    const persistNewTableData = vi.fn().mockResolvedValue(3);
    const maybeRefreshProfile = vi.fn().mockResolvedValue(undefined);
    const updateSyncStatus = vi.fn().mockResolvedValue(undefined);
    const captureHistorySyncCompleted = vi.fn();
    const flushAnalytics = vi.fn().mockResolvedValue(undefined);
    const logWarning = vi.fn();

    await finalizeSuccessfulBackfill(
      {
        userId: USER_ID,
        newestActivityDate: "2026-04-14",
        newWorkouts: 12,
      },
      {
        updateLastSyncedActivityDate,
        syncStrengthOnly,
        persistNewTableData,
        maybeRefreshProfile,
        updateSyncStatus,
        captureHistorySyncCompleted,
        flushAnalytics,
        logWarning,
      },
    );

    expect(updateLastSyncedActivityDate).toHaveBeenCalledWith({
      userId: USER_ID,
      date: "2026-04-14",
    });
    expect(syncStrengthOnly).toHaveBeenCalledOnce();
    expect(persistNewTableData).toHaveBeenCalledOnce();
    expect(logWarning).toHaveBeenCalledWith(
      `[historySync] Backfill enrichment completed with 3 failure(s) for user ${USER_ID}`,
    );
    expect(maybeRefreshProfile).toHaveBeenCalledOnce();
    expect(updateSyncStatus).toHaveBeenCalledWith({
      userId: USER_ID,
      syncStatus: "complete",
    });
    expect(captureHistorySyncCompleted).toHaveBeenCalledWith({
      new_workouts: 12,
      backfill: true,
      enrichment_failures: 3,
    });
    expect(flushAnalytics).toHaveBeenCalledOnce();
  });

  it("skips the date update and warning when there is no newest date and enrichment succeeds", async () => {
    const updateLastSyncedActivityDate = vi.fn().mockResolvedValue(undefined);
    const syncStrengthOnly = vi.fn().mockResolvedValue(undefined);
    const persistNewTableData = vi.fn().mockResolvedValue(0);
    const maybeRefreshProfile = vi.fn().mockResolvedValue(undefined);
    const updateSyncStatus = vi.fn().mockResolvedValue(undefined);
    const captureHistorySyncCompleted = vi.fn();
    const flushAnalytics = vi.fn().mockResolvedValue(undefined);
    const logWarning = vi.fn();

    await finalizeSuccessfulBackfill(
      {
        userId: USER_ID,
        newWorkouts: 0,
      },
      {
        updateLastSyncedActivityDate,
        syncStrengthOnly,
        persistNewTableData,
        maybeRefreshProfile,
        updateSyncStatus,
        captureHistorySyncCompleted,
        flushAnalytics,
        logWarning,
      },
    );

    expect(updateLastSyncedActivityDate).not.toHaveBeenCalled();
    expect(logWarning).not.toHaveBeenCalled();
    expect(updateSyncStatus).toHaveBeenCalledWith({
      userId: USER_ID,
      syncStatus: "complete",
    });
    expect(captureHistorySyncCompleted).toHaveBeenCalledWith({
      new_workouts: 0,
      backfill: true,
      enrichment_failures: 0,
    });
  });
});
