import { describe, expect, it, vi } from "vitest";
import type { Id } from "../_generated/dataModel";
import {
  EXTERNAL_ACTIVITIES_LIMIT,
  forceRefreshUserDataWithDeps,
  TONAL_REFRESH_CACHE_KEYS,
  WORKOUT_HISTORY_LIMIT,
} from "./refresh";
import { refreshTonalDataWithDeps } from "./refreshPublic";
import type { TonalUser } from "./types";

const USER_ID = "user_123" as Id<"users">;

function buildTonalUser(overrides: Partial<TonalUser> = {}): TonalUser {
  return {
    id: "tonal-user-1",
    email: "ada@example.com",
    firstName: "Ada",
    lastName: "Lovelace",
    username: "ada",
    gender: "female",
    dateOfBirth: "1990-12-10",
    createdAt: "2024-01-02T00:00:00.000Z",
    updatedAt: "2024-01-03T00:00:00.000Z",
    heightInches: 65,
    weightPounds: 135,
    auth0Id: "auth0|ada",
    workoutsPerWeek: 4,
    workoutDurationMin: 30,
    workoutDurationMax: 45,
    tonalStatus: "advanced",
    accountType: "trial",
    location: "Denver",
    ...overrides,
  };
}

describe("forceRefreshUserDataWithDeps", () => {
  it("clears the known cache keys, backfills history, and updates profile data", async () => {
    const deleteUserCacheEntries = vi.fn().mockResolvedValue(undefined);
    const backfillUserHistory = vi.fn().mockResolvedValue({
      newWorkouts: 3,
      totalActivities: 14,
    });
    const fetchUserProfile = vi.fn().mockResolvedValue(buildTonalUser());
    const fetchStrengthDistribution = vi.fn().mockResolvedValue({});
    const fetchWorkoutHistory = vi.fn().mockResolvedValue([]);
    const fetchExternalActivities = vi.fn().mockResolvedValue([]);
    const updateProfileData = vi.fn().mockResolvedValue(undefined);
    const logError = vi.fn();

    const result = await forceRefreshUserDataWithDeps(USER_ID, {
      deleteUserCacheEntries,
      backfillUserHistory,
      fetchUserProfile,
      fetchStrengthDistribution,
      fetchWorkoutHistory,
      fetchExternalActivities,
      updateProfileData,
      logError,
      now: () => 1234,
    });

    expect(result).toEqual({
      refreshedAt: 1234,
      newWorkouts: 3,
      totalActivities: 14,
    });
    expect(deleteUserCacheEntries).toHaveBeenCalledWith({
      userId: USER_ID,
      dataTypes: [...TONAL_REFRESH_CACHE_KEYS],
    });
    expect(backfillUserHistory).toHaveBeenCalledWith({ userId: USER_ID });
    expect(fetchUserProfile).toHaveBeenCalledWith({ userId: USER_ID });
    expect(fetchStrengthDistribution).toHaveBeenCalledWith({ userId: USER_ID });
    expect(fetchWorkoutHistory).toHaveBeenCalledWith({
      userId: USER_ID,
      limit: WORKOUT_HISTORY_LIMIT,
    });
    expect(fetchExternalActivities).toHaveBeenCalledWith({
      userId: USER_ID,
      limit: EXTERNAL_ACTIVITIES_LIMIT,
    });
    expect(updateProfileData).toHaveBeenCalledWith({
      userId: USER_ID,
      profileData: expect.objectContaining({
        firstName: "Ada",
        lastName: "Lovelace",
        level: "advanced",
        username: "ada",
      }),
    });
    expect(logError).not.toHaveBeenCalled();
  });

  it("logs warm-up failures and still returns the backfill result", async () => {
    const deleteUserCacheEntries = vi.fn().mockResolvedValue(undefined);
    const backfillUserHistory = vi.fn().mockResolvedValue({
      newWorkouts: 0,
      totalActivities: 0,
    });
    const updateProfileData = vi.fn().mockResolvedValue(undefined);
    const logError = vi.fn();

    const result = await forceRefreshUserDataWithDeps(USER_ID, {
      deleteUserCacheEntries,
      backfillUserHistory,
      fetchUserProfile: vi.fn().mockRejectedValue(new Error("profile failed")),
      fetchStrengthDistribution: vi.fn().mockRejectedValue(new Error("distribution failed")),
      fetchWorkoutHistory: vi.fn().mockRejectedValue(new Error("history failed")),
      fetchExternalActivities: vi.fn().mockRejectedValue(new Error("external failed")),
      updateProfileData,
      logError,
      now: () => 2222,
    });

    expect(result).toEqual({
      refreshedAt: 2222,
      newWorkouts: 0,
      totalActivities: 0,
    });
    expect(updateProfileData).not.toHaveBeenCalled();
    expect(logError).toHaveBeenCalledTimes(4);
    expect(logError).toHaveBeenCalledWith(
      "[tonalRefresh] Profile refresh failed",
      expect.any(Error),
    );
    expect(logError).toHaveBeenCalledWith(
      "[tonalRefresh] Failed to warm strength distribution",
      expect.any(Error),
    );
    expect(logError).toHaveBeenCalledWith(
      `[tonalRefresh] Failed to warm ${WORKOUT_HISTORY_LIMIT}-workout history`,
      expect.any(Error),
    );
    expect(logError).toHaveBeenCalledWith(
      `[tonalRefresh] Failed to warm ${EXTERNAL_ACTIVITIES_LIMIT} external activities`,
      expect.any(Error),
    );
  });

  it("logs profile persistence failures and still returns the backfill result", async () => {
    const deleteUserCacheEntries = vi.fn().mockResolvedValue(undefined);
    const backfillUserHistory = vi.fn().mockResolvedValue({
      newWorkouts: 1,
      totalActivities: 6,
    });
    const updateProfileData = vi.fn().mockRejectedValue(new Error("write failed"));
    const logError = vi.fn();

    const result = await forceRefreshUserDataWithDeps(USER_ID, {
      deleteUserCacheEntries,
      backfillUserHistory,
      fetchUserProfile: vi.fn().mockResolvedValue(buildTonalUser()),
      fetchStrengthDistribution: vi.fn().mockResolvedValue({}),
      fetchWorkoutHistory: vi.fn().mockResolvedValue([]),
      fetchExternalActivities: vi.fn().mockResolvedValue([]),
      updateProfileData,
      logError,
      now: () => 3333,
    });

    expect(result).toEqual({
      refreshedAt: 3333,
      newWorkouts: 1,
      totalActivities: 6,
    });
    expect(logError).toHaveBeenCalledWith(
      `[tonalRefresh] Failed to update profile data during refresh warm-up for user ${USER_ID}`,
      expect.any(Error),
    );
  });
});

describe("refreshTonalDataWithDeps", () => {
  it("returns session_expired for unauthenticated users", async () => {
    const result = await refreshTonalDataWithDeps({
      resolveEffectiveUserId: vi.fn().mockResolvedValue(null),
      getProfile: vi.fn(),
      limitRefresh: vi.fn(),
      forceRefreshUserData: vi.fn(),
    });

    expect(result).toEqual({ error: "session_expired" });
  });

  it("returns not_connected when the user has not connected Tonal", async () => {
    const getProfile = vi.fn().mockResolvedValue(null);

    const result = await refreshTonalDataWithDeps({
      resolveEffectiveUserId: vi.fn().mockResolvedValue(USER_ID),
      getProfile,
      limitRefresh: vi.fn(),
      forceRefreshUserData: vi.fn(),
    });

    expect(result).toEqual({ error: "not_connected" });
    expect(getProfile).toHaveBeenCalledWith({ userId: USER_ID });
  });

  it("returns rate_limited when the limiter rejects with a 429", async () => {
    const result = await refreshTonalDataWithDeps({
      resolveEffectiveUserId: vi.fn().mockResolvedValue(USER_ID),
      getProfile: vi.fn().mockResolvedValue({ userId: USER_ID }),
      limitRefresh: vi
        .fn()
        .mockRejectedValue(Object.assign(new Error("Rate limit exceeded"), { status: 429 })),
      forceRefreshUserData: vi.fn(),
    });

    expect(result).toEqual({ error: "rate_limited" });
  });

  it("rethrows unexpected limiter failures", async () => {
    await expect(
      refreshTonalDataWithDeps({
        resolveEffectiveUserId: vi.fn().mockResolvedValue(USER_ID),
        getProfile: vi.fn().mockResolvedValue({ userId: USER_ID }),
        limitRefresh: vi.fn().mockRejectedValue(new Error("storage offline")),
        forceRefreshUserData: vi.fn(),
      }),
    ).rejects.toThrow("storage offline");
  });

  it("returns rate_limited error when the rate limiter throws", async () => {
    const result = await refreshTonalDataWithDeps({
      resolveEffectiveUserId: vi.fn().mockResolvedValue(USER_ID),
      getProfile: vi.fn().mockResolvedValue({ userId: USER_ID }),
      limitRefresh: vi.fn().mockRejectedValue(new Error("Rate limit exceeded")),
      forceRefreshUserData: vi.fn(),
    });

    expect(result).toEqual({ error: "rate_limited" });
  });

  it("rate-limits before forcing a refresh and returns the refresh result", async () => {
    const calls: string[] = [];
    const result = {
      refreshedAt: 999,
      newWorkouts: 2,
      totalActivities: 11,
    };

    const refresh = await refreshTonalDataWithDeps({
      resolveEffectiveUserId: vi.fn().mockImplementation(async () => {
        calls.push("resolve");
        return USER_ID;
      }),
      getProfile: vi.fn().mockImplementation(async ({ userId }) => {
        calls.push(`profile:${userId}`);
        return { userId };
      }),
      limitRefresh: vi.fn().mockImplementation(async (userId) => {
        calls.push(`limit:${userId}`);
      }),
      forceRefreshUserData: vi.fn().mockImplementation(async ({ userId }) => {
        calls.push(`refresh:${userId}`);
        return result;
      }),
    });

    expect(refresh).toEqual(result);
    expect(calls).toEqual([
      "resolve",
      `profile:${USER_ID}`,
      `limit:${USER_ID}`,
      `refresh:${USER_ID}`,
    ]);
  });
});
