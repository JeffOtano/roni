import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getFunctionName } from "convex/server";
import {
  buildTrainingSnapshot,
  formatExternalActivityLine,
  getHrIntensityLabel,
  type SnapshotSection,
  trimSnapshot,
} from "./context";
import { getTrainingSnapshotForChat } from "./trainingSnapshotCache";
import { internal } from "../_generated/api";
import type { ExternalActivity } from "../tonal/types";

describe("trimSnapshot", () => {
  const makeSection = (priority: number, text: string): SnapshotSection => ({
    priority,
    lines: [text],
  });

  it("returns all sections when under budget", () => {
    const sections = [
      makeSection(1, "User: Alice | 65in/140lbs"),
      makeSection(5, "Training Block: Building Week 2/4"),
    ];
    const result = trimSnapshot(sections, 4000);
    expect(result).toContain("Alice");
    expect(result).toContain("Training Block");
  });

  it("drops lowest-priority sections first when over budget", () => {
    const sections = [
      makeSection(1, "User: Alice | 65in/140lbs"),
      makeSection(11, "Missed: Monday Push was programmed but not completed"),
      makeSection(10, "Performance: Volume up 15%"),
    ];
    const result = trimSnapshot(sections, 80);
    expect(result).toContain("Alice");
    expect(result).not.toContain("Missed");
    expect(result).not.toContain("Performance");
  });

  it("keeps header and footer regardless of budget", () => {
    const sections = [makeSection(1, "User: Alice")];
    const result = trimSnapshot(sections, 10);
    expect(result).toContain("=== TRAINING SNAPSHOT ===");
    expect(result).toContain("=== END SNAPSHOT ===");
    expect(result).not.toContain("Alice");
  });

  it("handles empty sections array", () => {
    const result = trimSnapshot([], 4000);
    expect(result).toContain("=== TRAINING SNAPSHOT ===");
    expect(result).toContain("=== END SNAPSHOT ===");
  });

  it("drops multiple low-priority sections to fit budget", () => {
    const sections = [
      makeSection(1, "User: Alice"),
      makeSection(3, "Injuries: left shoulder (mild)"),
      makeSection(7, "Scores: Upper 450, Lower 380"),
      makeSection(8, "Readiness: Chest 85, Back 72"),
      makeSection(9, "Workout: 2026-03-15 | Push Day"),
      makeSection(10, "Performance: Volume up 15%"),
      makeSection(11, "Missed: Monday Push"),
    ];
    // Budget of 150 should fit header(25)+footer(18)+2newlines + User(12) + Injuries(31) + Scores(28) = ~116
    const result = trimSnapshot(sections, 150);
    expect(result).toContain("Alice");
    expect(result).toContain("Injuries");
    expect(result).not.toContain("Missed");
    expect(result).not.toContain("Performance");
  });
});

// HR intensity labels

describe("getHrIntensityLabel", () => {
  it("returns null for zero HR", () => {
    expect(getHrIntensityLabel(0)).toBeNull();
  });

  it("returns 'light' for HR below 100", () => {
    expect(getHrIntensityLabel(90)).toBe("light");
  });

  it("returns 'moderate' for HR between 100 and 130", () => {
    expect(getHrIntensityLabel(115)).toBe("moderate");
  });

  it("returns 'vigorous' for HR above 130", () => {
    expect(getHrIntensityLabel(145)).toBe("vigorous");
  });

  it("returns 'moderate' at exactly 100", () => {
    expect(getHrIntensityLabel(100)).toBe("moderate");
  });

  it("returns 'vigorous' at exactly 131", () => {
    expect(getHrIntensityLabel(131)).toBe("vigorous");
  });
});

// Format line

describe("formatExternalActivityLine", () => {
  function makeExternal(overrides: Partial<ExternalActivity> = {}): ExternalActivity {
    return {
      id: "ext-1",
      userId: "user-1",
      workoutType: "pickleball",
      beginTime: "2026-03-15T14:00:00Z",
      endTime: "2026-03-15T16:00:00Z",
      timezone: "America/Denver",
      activeDuration: 7200,
      totalDuration: 7200,
      distance: 0,
      activeCalories: 0,
      totalCalories: 1100,
      averageHeartRate: 140,
      source: "Apple Watch",
      externalId: "ext-id",
      deviceId: "device-1",
      ...overrides,
    };
  }

  it("formats a standard activity line", () => {
    const line = formatExternalActivityLine(makeExternal());
    expect(line).toContain("Pickleball");
    expect(line).toContain("Apple Watch");
    expect(line).toContain("120min");
    expect(line).toContain("1100 cal");
    expect(line).toContain("vigorous");
  });

  it("omits HR label when averageHeartRate is 0", () => {
    const line = formatExternalActivityLine(makeExternal({ averageHeartRate: 0 }));
    expect(line).not.toContain("Avg HR");
  });

  it("capitalizes and space-separates camelCase workout type", () => {
    const line = formatExternalActivityLine(
      makeExternal({ workoutType: "traditionalStrengthTraining" }),
    );
    expect(line).toContain("Traditional Strength Training");
  });
});

describe("buildTrainingSnapshot", () => {
  it("does not load or inject the exercise catalog into every chat turn", async () => {
    const getAllMovementsName = getFunctionName(internal.tonal.movementSync.getAllMovements);
    const getUserProfileName = getFunctionName(internal.tonal.cache.getUserProfile);
    const nullableQueryNames = new Set([
      getFunctionName(internal.tonal.syncQueries.getMuscleReadiness),
      getFunctionName(internal.coach.periodization.getActiveBlock),
      getFunctionName(internal.weekPlans.getByUserIdAndWeekStartInternal),
    ]);
    const queryCalls: string[] = [];
    const ctx = {
      runQuery: async (query: unknown) => {
        const queryName = getFunctionName(query as never);
        queryCalls.push(queryName);
        if (queryName === getAllMovementsName) {
          throw new Error("movement catalog should not be loaded");
        }
        if (queryName === getUserProfileName) {
          return {
            profileData: {
              firstName: "Alice",
              lastName: "Lifter",
              heightInches: 66,
              weightPounds: 150,
              level: "intermediate",
              workoutsPerWeek: 4,
              dateOfBirth: "1990-01-01",
            },
            ownedAccessories: {
              smartHandles: true,
              smartBar: true,
              rope: false,
              roller: true,
              weightBar: true,
              pilatesLoops: true,
              ankleStraps: true,
            },
          };
        }
        if (nullableQueryNames.has(queryName)) {
          return null;
        }
        return [];
      },
    };

    const snapshot = await buildTrainingSnapshot(ctx as never, "user-1");

    expect(queryCalls).not.toContain(getAllMovementsName);
    expect(snapshot).not.toContain("Available Tonal Exercises");
    expect(snapshot).toContain("Equipment:");
  });
});

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
    const getUserProfileName = getFunctionName(internal.tonal.cache.getUserProfile);
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
        if (queryName === getUserProfileName) return null;
        return [];
      },
    };

    const result = await getTrainingSnapshotForChat(ctx as never, "user-1", "America/Los_Angeles");

    expect(result.source).toBe("live_rebuild");
    expect(result.snapshot).toContain("No Tonal profile linked yet");
  });

  it("falls back to live rebuild when coachState has no usable snapshot", async () => {
    const getForUserName = getFunctionName(internal.coachState.getForUser);
    const getUserProfileName = getFunctionName(internal.tonal.cache.getUserProfile);
    const ctx = {
      runQuery: async (query: unknown) => {
        const queryName = getFunctionName(query as never);
        if (queryName === getForUserName) return null;
        if (queryName === getUserProfileName) return null;
        return [];
      },
    };

    const result = await getTrainingSnapshotForChat(ctx as never, "user-1");

    expect(result.source).toBe("live_rebuild");
    expect(result.snapshot).toContain("No Tonal profile linked yet");
  });
});
