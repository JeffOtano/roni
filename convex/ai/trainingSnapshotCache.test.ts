import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import { getTrainingSnapshotForChat } from "./trainingSnapshotCache";
import { internal } from "../_generated/api";

describe("getTrainingSnapshotForChat", () => {
  const NOW = new Date("2026-04-24T12:00:00.000Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("builds the snapshot via live rebuild on every call", async () => {
    const gatherSnapshotInputsName = getFunctionName(internal.coachState.gatherSnapshotInputs);
    const ctx = {
      runQuery: async (query: unknown) => {
        if (getFunctionName(query as never) === gatherSnapshotInputsName) {
          return {
            profile: null,
            scores: [],
            readiness: null,
            activities: [],
            activeBlock: null,
            recentFeedback: [],
            activeGoals: [],
            activeInjuries: [],
            externalActivities: [],
            garminWellness: [],
          };
        }
        return [];
      },
    };

    const result = await getTrainingSnapshotForChat(ctx as never, "user-1");

    expect(result.source).toBe("live_rebuild");
    expect(result.snapshot).toContain("No Tonal profile linked yet");
  });
});
