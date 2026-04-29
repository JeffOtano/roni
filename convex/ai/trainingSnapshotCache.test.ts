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

  it("rebuilds on every call (no cached source)", async () => {
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

    const first = await getTrainingSnapshotForChat(ctx as never, "user-1");
    const second = await getTrainingSnapshotForChat(ctx as never, "user-1");

    expect(first.source).toBe("live_rebuild");
    expect(second.source).toBe("live_rebuild");
    expect(first.snapshot).toContain("No Tonal profile linked yet");
    expect(second.snapshot).toContain("No Tonal profile linked yet");
  });
});
