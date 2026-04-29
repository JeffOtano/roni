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

  it("returns a fresh materialized coachState snapshot when available", async () => {
    const getForUserName = getFunctionName(internal.coachState.getForUser);
    const ctx = {
      runQuery: async (query: unknown) => {
        if (getFunctionName(query as never) === getForUserName) {
          return { snapshot: "cached snapshot", refreshedAt: NOW.getTime() - 1000 };
        }
        throw new Error("live rebuild should not run");
      },
    };

    const result = await getTrainingSnapshotForChat(ctx as never, "user-1");

    expect(result.snapshot).toBe("cached snapshot");
    expect(result.source).toBe("coach_state_fresh");
  });

  it("returns a stale materialized snapshot with stale source when timezone matches", async () => {
    const getForUserName = getFunctionName(internal.coachState.getForUser);
    const ctx = {
      runQuery: async (query: unknown) => {
        if (getFunctionName(query as never) === getForUserName) {
          return { snapshot: "old snapshot", refreshedAt: NOW.getTime() - 60 * 60 * 1000 };
        }
        throw new Error("live rebuild should not run");
      },
    };

    const result = await getTrainingSnapshotForChat(ctx as never, "user-1");

    expect(result.snapshot).toBe("old snapshot");
    expect(result.source).toBe("coach_state_stale");
  });

  it("uses live rebuild when the cached snapshot was built for another timezone", async () => {
    const getForUserName = getFunctionName(internal.coachState.getForUser);
    const gatherSnapshotInputsName = getFunctionName(internal.coachState.gatherSnapshotInputs);
    const ctx = {
      runQuery: async (query: unknown) => {
        const queryName = getFunctionName(query as never);
        if (queryName === getForUserName) {
          return {
            snapshot: "wrong timezone snapshot",
            refreshedAt: NOW.getTime(),
            userTimezone: "America/New_York",
          };
        }
        if (queryName === gatherSnapshotInputsName) {
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

    const result = await getTrainingSnapshotForChat(ctx as never, "user-1", "America/Los_Angeles");

    expect(result.source).toBe("live_rebuild");
    expect(result.snapshot).toContain("No Tonal profile linked yet");
  });

  it("falls back to live rebuild when coachState has no usable snapshot", async () => {
    const getForUserName = getFunctionName(internal.coachState.getForUser);
    const gatherSnapshotInputsName = getFunctionName(internal.coachState.gatherSnapshotInputs);
    const ctx = {
      runQuery: async (query: unknown) => {
        const queryName = getFunctionName(query as never);
        if (queryName === getForUserName) return null;
        if (queryName === gatherSnapshotInputsName) {
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
