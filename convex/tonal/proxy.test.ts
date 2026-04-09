import { beforeEach, describe, expect, it, vi } from "vitest";
import { TonalApiError } from "./client";

// Mock modules before importing the function under test
vi.mock("./encryption", () => ({
  decrypt: vi.fn(async (val: string) => `decrypted:${val}`),
  encrypt: vi.fn(async (val: string) => `encrypted:${val}`),
}));

vi.mock("./auth", () => ({
  refreshTonalToken: vi.fn(),
}));

vi.mock("../_generated/api", () => ({
  internal: {
    tonal: { cache: { getUserProfile: "getUserProfile" } },
    userProfiles: {
      markTokenExpired: "markTokenExpired",
      updateTonalToken: "updateTonalToken",
      acquireTokenRefreshLock: "acquireTokenRefreshLock",
      releaseTokenRefreshLock: "releaseTokenRefreshLock",
    },
  },
}));

vi.mock("./proxy", () => ({
  withTonalToken: vi.fn(),
}));

import { withTokenRetry } from "./tokenRetry";
import { withTonalToken } from "./proxy";
import { refreshTonalToken } from "./auth";
import type { ActionCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

const TEST_USER_ID = "test-user-123" as Id<"users">;
const TEST_TONAL_USER_ID = "tonal-456";

function makeProfile(overrides?: Record<string, unknown>) {
  return {
    tonalToken: "encrypted-access-token",
    tonalUserId: TEST_TONAL_USER_ID,
    tonalRefreshToken: "encrypted-refresh-token",
    ...overrides,
  };
}

function makeMockCtx(profile = makeProfile()) {
  return {
    runQuery: vi.fn(async () => profile),
    runMutation: vi.fn(async (mutationRef: string) => {
      // acquireTokenRefreshLock must return true so the lock path is taken
      if (mutationRef === "acquireTokenRefreshLock") return true;
      return undefined;
    }),
  } as unknown as ActionCtx;
}

describe("withTokenRetry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TOKEN_ENCRYPTION_KEY = "a".repeat(64);
    vi.mocked(withTonalToken).mockResolvedValue({
      token: "decrypted:encrypted-access-token",
      tonalUserId: TEST_TONAL_USER_ID,
    });
  });

  it("returns result when fn succeeds on first try", async () => {
    const ctx = makeMockCtx();
    const fn = vi.fn(async () => "success");

    const result = await withTokenRetry(ctx, TEST_USER_ID, fn);

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("decrypted:encrypted-access-token", TEST_TONAL_USER_ID);
  });

  it("retries with fresh token after 401", async () => {
    const ctx = makeMockCtx();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new TonalApiError(401, "Token expired"))
      .mockResolvedValueOnce("retry-success");

    vi.mocked(refreshTonalToken).mockResolvedValueOnce({
      idToken: "new-access-token",
      refreshToken: "new-refresh-token",
      expiresAt: Date.now() + 3600000,
    });

    const result = await withTokenRetry(ctx, TEST_USER_ID, fn);

    expect(result).toBe("retry-success");
    expect(fn).toHaveBeenCalledTimes(2);
    // Second call uses the fresh (unencrypted) token directly
    expect(fn).toHaveBeenLastCalledWith("new-access-token", TEST_TONAL_USER_ID);
    // Persisted new tokens
    expect(ctx.runMutation).toHaveBeenCalledWith("updateTonalToken", {
      userId: TEST_USER_ID,
      tonalToken: "encrypted:new-access-token",
      tonalRefreshToken: "encrypted:new-refresh-token",
      tonalTokenExpiresAt: expect.any(Number),
    });
  });

  it("marks token expired and throws when no refresh token stored", async () => {
    const profile = makeProfile({ tonalRefreshToken: undefined });
    const ctx = makeMockCtx(profile);
    const fn = vi.fn().mockRejectedValueOnce(new TonalApiError(401, "Token expired"));

    await expect(withTokenRetry(ctx, TEST_USER_ID, fn)).rejects.toThrow(
      "Tonal session expired — please reconnect",
    );
    expect(ctx.runMutation).toHaveBeenCalledWith("markTokenExpired", { userId: TEST_USER_ID });
  });

  it("marks token expired and throws when refresh fails", async () => {
    const ctx = makeMockCtx();
    const fn = vi.fn().mockRejectedValueOnce(new TonalApiError(401, "Token expired"));
    vi.mocked(refreshTonalToken).mockRejectedValueOnce(new Error("refresh failed"));

    await expect(withTokenRetry(ctx, TEST_USER_ID, fn)).rejects.toThrow(
      "Tonal session expired — please reconnect",
    );
    expect(ctx.runMutation).toHaveBeenCalledWith("markTokenExpired", { userId: TEST_USER_ID });
  });

  it("marks token expired when retry also returns 401", async () => {
    const ctx = makeMockCtx();
    const fn = vi.fn().mockRejectedValue(new TonalApiError(401, "Token expired"));

    vi.mocked(refreshTonalToken).mockResolvedValueOnce({
      idToken: "new-access-token",
      refreshToken: "new-refresh-token",
      expiresAt: Date.now() + 3600000,
    });

    await expect(withTokenRetry(ctx, TEST_USER_ID, fn)).rejects.toThrow(
      "Tonal session expired — please reconnect",
    );
    expect(fn).toHaveBeenCalledTimes(2);
    expect(ctx.runMutation).toHaveBeenCalledWith("markTokenExpired", { userId: TEST_USER_ID });
  });

  it("propagates non-401 errors without retrying", async () => {
    const ctx = makeMockCtx();
    const fn = vi.fn().mockRejectedValueOnce(new TonalApiError(500, "Server error"));

    await expect(withTokenRetry(ctx, TEST_USER_ID, fn)).rejects.toThrow("Tonal API 500");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(ctx.runMutation).not.toHaveBeenCalled();
  });

  it("propagates non-TonalApiError errors without retrying", async () => {
    const ctx = makeMockCtx();
    const fn = vi.fn().mockRejectedValueOnce(new Error("network failure"));

    await expect(withTokenRetry(ctx, TEST_USER_ID, fn)).rejects.toThrow("network failure");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("propagates non-401 errors on retry without marking expired", async () => {
    const ctx = makeMockCtx();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new TonalApiError(401, "Token expired"))
      .mockRejectedValueOnce(new TonalApiError(500, "Server error"));

    vi.mocked(refreshTonalToken).mockResolvedValueOnce({
      idToken: "new-access-token",
      refreshToken: "new-refresh-token",
      expiresAt: Date.now() + 3600000,
    });

    await expect(withTokenRetry(ctx, TEST_USER_ID, fn)).rejects.toThrow("Tonal API 500");
    expect(fn).toHaveBeenCalledTimes(2);
    // updateTonalToken called (refresh succeeded), but NOT markTokenExpired
    expect(ctx.runMutation).toHaveBeenCalledWith("updateTonalToken", expect.any(Object));
    expect(ctx.runMutation).not.toHaveBeenCalledWith("markTokenExpired", expect.any(Object));
  });
});
