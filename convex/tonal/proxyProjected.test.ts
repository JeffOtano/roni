import { describe, expect, it } from "vitest";
import { TonalApiError } from "./client";

// ---------------------------------------------------------------------------
// 404 fetcher logic — mirrors the try/catch in fetchFormattedSummary's fetcher
// ---------------------------------------------------------------------------

async function applyFormattedSummaryFetcherGuard<T>(fetch: () => Promise<T>): Promise<T | null> {
  try {
    return await fetch();
  } catch (error) {
    if (error instanceof TonalApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

describe("fetchFormattedSummary 404 guard", () => {
  it("returns null when Tonal API responds with 404", async () => {
    const result = await applyFormattedSummaryFetcherGuard(async () => {
      throw new TonalApiError(404, '{"message":"workout summary doesn\'t exist","status":404}');
    });

    expect(result).toBeNull();
  });

  it("propagates TonalApiError when status is not 404", async () => {
    await expect(
      applyFormattedSummaryFetcherGuard(async () => {
        throw new TonalApiError(500, "Internal Server Error");
      }),
    ).rejects.toThrow("Tonal API 500");
  });

  it("propagates TonalApiError 401 so token-retry logic can handle it", async () => {
    await expect(
      applyFormattedSummaryFetcherGuard(async () => {
        throw new TonalApiError(401, "Unauthorized");
      }),
    ).rejects.toThrow("Tonal API 401");
  });

  it("propagates non-TonalApiError errors unchanged", async () => {
    const networkError = new TypeError("fetch failed");
    await expect(
      applyFormattedSummaryFetcherGuard(async () => {
        throw networkError;
      }),
    ).rejects.toBe(networkError);
  });

  it("returns the projection result when the fetch succeeds", async () => {
    const data = { movementSets: [], totalVolume: 0 };
    const result = await applyFormattedSummaryFetcherGuard(async () => data);
    expect(result).toBe(data);
  });
});

// ---------------------------------------------------------------------------
// shouldCache guard — null results must not be cached
// ---------------------------------------------------------------------------

describe("shouldCache: (d) => d !== null", () => {
  const shouldCache = (d: unknown) => d !== null;

  it("returns false for null so 404 results are never pinned in cache", () => {
    expect(shouldCache(null)).toBe(false);
  });

  it("returns true for a valid FormattedWorkoutSummary-shaped object", () => {
    expect(shouldCache({ movementSets: [], totalVolume: 0 })).toBe(true);
  });

  it("returns true for empty-ish but non-null data", () => {
    expect(shouldCache({})).toBe(true);
  });
});
