import { afterEach, describe, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import * as analytics from "../lib/posthog";
import { backfillUserHistoryHandler } from "./historySync";
import type { StrengthScore } from "./types";

vi.mock("../lib/posthog", () => ({
  capture: vi.fn(),
  flush: vi.fn().mockResolvedValue(undefined),
}));

const USER_ID = "user_123" as Id<"users">;
const FUNCTION_NAMES = {
  fetchWorkoutHistoryPage: getFunctionName(
    internal.tonal.workoutHistoryProxy.fetchWorkoutHistoryPage,
  ),
  fetchStrengthHistory: getFunctionName(internal.tonal.proxy.fetchStrengthHistory),
  fetchStrengthScores: getFunctionName(internal.tonal.proxy.fetchStrengthScores),
  fetchMuscleReadiness: getFunctionName(internal.tonal.proxy.fetchMuscleReadiness),
  fetchExternalActivities: getFunctionName(internal.tonal.proxy.fetchExternalActivities),
  updateSyncStatus: getFunctionName(internal.userProfiles.updateSyncStatus),
  persistCurrentStrengthScores: getFunctionName(
    internal.tonal.historySyncMutations.persistCurrentStrengthScores,
  ),
  getDeletionInProgress: getFunctionName(internal.lib.auth.getDeletionInProgress),
  getByUserId: getFunctionName(internal.userProfiles.getByUserId),
};

describe("backfillUserHistoryHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("marks the real backfill action complete when enrichment partially fails", async () => {
    const strengthScores: StrengthScore[] = [
      {
        id: "score-1",
        userId: "tonal-user-1",
        strengthBodyRegion: "upper",
        bodyRegionDisplay: "Upper",
        score: 109,
        current: true,
      },
    ];
    const syncStatusWrites: string[] = [];
    const runAfter = vi.fn();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const runAction = vi.fn(async (ref: unknown) => {
      const functionName = getFunctionName(ref as Parameters<typeof getFunctionName>[0]);

      if (functionName === FUNCTION_NAMES.fetchWorkoutHistoryPage) {
        return { activities: [], pageSize: 0, pgTotal: 0 };
      }
      if (functionName === FUNCTION_NAMES.fetchStrengthHistory) {
        return [];
      }
      if (functionName === FUNCTION_NAMES.fetchStrengthScores) {
        return strengthScores;
      }
      if (functionName === FUNCTION_NAMES.fetchMuscleReadiness) {
        throw new Error("Muscle readiness unavailable");
      }
      if (functionName === FUNCTION_NAMES.fetchExternalActivities) {
        return [];
      }
      throw new Error(`Unexpected action reference: ${functionName}`);
    });
    const runMutation = vi.fn(async (ref: unknown, args: unknown) => {
      if (
        getFunctionName(ref as Parameters<typeof getFunctionName>[0]) ===
        FUNCTION_NAMES.updateSyncStatus
      ) {
        syncStatusWrites.push((args as { syncStatus: string }).syncStatus);
      }
      return null;
    });
    const runQuery = vi.fn(async (ref: unknown) => {
      if (
        getFunctionName(ref as Parameters<typeof getFunctionName>[0]) ===
        FUNCTION_NAMES.getDeletionInProgress
      ) {
        return false;
      }
      if (
        getFunctionName(ref as Parameters<typeof getFunctionName>[0]) === FUNCTION_NAMES.getByUserId
      ) {
        return { profileDataRefreshedAt: Date.now() };
      }
      throw new Error(
        `Unexpected query reference: ${getFunctionName(ref as Parameters<typeof getFunctionName>[0])}`,
      );
    });
    const ctx = {
      runAction,
      runMutation,
      runQuery,
      scheduler: { runAfter },
    } as unknown as ActionCtx;

    const result = await backfillUserHistoryHandler(ctx, {
      userId: USER_ID,
    });

    expect(result).toEqual({ newWorkouts: 0, totalActivities: 0 });
    expect(syncStatusWrites).toEqual(["syncing", "complete"]);
    expect(runAfter).not.toHaveBeenCalled();
    const persistStrengthScoresCall = runMutation.mock.calls.find(
      ([ref]) =>
        getFunctionName(ref as Parameters<typeof getFunctionName>[0]) ===
        FUNCTION_NAMES.persistCurrentStrengthScores,
    );
    expect(persistStrengthScoresCall?.[1]).toEqual({
      userId: USER_ID,
      scores: [{ bodyRegion: "Upper", score: 109 }],
    });
    expect(consoleError).toHaveBeenCalledWith(
      "[historySync] Muscle readiness fetch failed",
      expect.any(Error),
    );
    expect(consoleWarn).toHaveBeenCalledWith(
      `[historySync] Backfill enrichment completed with 1 failure(s) for user ${USER_ID}`,
    );
    expect(analytics.capture).toHaveBeenCalledWith(USER_ID, "history_sync_completed", {
      new_workouts: 0,
      backfill: true,
      enrichment_failures: 1,
    });
    expect(analytics.flush).toHaveBeenCalledOnce();
  });
});
