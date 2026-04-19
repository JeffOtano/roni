import { afterEach, describe, expect, it, vi } from "vitest";
import type { ActionCtx } from "../_generated/server";
import { cachedFetch, fetchWorkoutMetaBatch } from "./proxy";
import { MAX_CACHE_VALUE_BYTES } from "./proxyCacheLimits";

type CacheRow = {
  data: unknown;
  fetchedAt: number;
  expiresAt: number;
};

function makeCacheKey(userId: unknown, dataType: string) {
  return `${String(userId ?? "global")}:${dataType}`;
}

function makeMockCtx() {
  const cache = new Map<string, CacheRow>();

  const runQuery = vi.fn(async (_ref: unknown, args: Record<string, unknown>) => {
    if ("dataType" in args) {
      return cache.get(makeCacheKey(args.userId, String(args.dataType))) ?? null;
    }
    if ("service" in args) {
      return false;
    }
    return null;
  });

  const runMutation = vi.fn(async (_ref: unknown, args: Record<string, unknown>) => {
    if ("dataType" in args && "data" in args) {
      cache.set(makeCacheKey(args.userId, String(args.dataType)), {
        data: args.data,
        fetchedAt: Number(args.fetchedAt),
        expiresAt: Number(args.expiresAt),
      });
      return undefined;
    }
    if ("dataType" in args) {
      cache.delete(makeCacheKey(args.userId, String(args.dataType)));
      return true;
    }
    return undefined;
  });

  return {
    cache,
    runQuery,
    runMutation,
    ctx: {
      runQuery,
      runMutation,
    } as unknown as ActionCtx,
  };
}

function makeJsonResponse(payload: unknown): Response {
  return {
    ok: true,
    status: 200,
    headers: {
      get: () => null,
    },
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  } as unknown as Response;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("cachedFetch", () => {
  it("skips doomed cache writes before calling the cache mutation", async () => {
    const { ctx, runMutation } = makeMockCtx();
    const fetcher = vi.fn().mockResolvedValue({ payload: "x".repeat(MAX_CACHE_VALUE_BYTES + 1) });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await cachedFetch(ctx, {
      dataType: "oversized",
      ttl: 60_000,
      fetcher,
    });

    await cachedFetch(ctx, {
      dataType: "oversized",
      ttl: 60_000,
      fetcher,
    });

    const cacheWriteCalls = runMutation.mock.calls.filter(
      ([, args]) => args && typeof args === "object" && "dataType" in args && "data" in args,
    );

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(cacheWriteCalls).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalledWith(
      "cachedFetch(oversized): payload too large to cache, skipping write",
    );
  });
});

describe("fetchWorkoutMetaBatch", () => {
  it("projects large workout responses before caching and reuses the cached metadata", async () => {
    const { ctx, cache } = makeMockCtx();
    const fetchMock = vi.fn(async () =>
      makeJsonResponse({
        title: "Push Day",
        targetArea: "Upper Body",
        blocks: "x".repeat(MAX_CACHE_VALUE_BYTES + 50_000),
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const first = await fetchWorkoutMetaBatch(ctx, "token", ["workout-1"]);
    const second = await fetchWorkoutMetaBatch(ctx, "token", ["workout-1"]);

    expect(first.get("workout-1")).toEqual({
      title: "Push Day",
      targetArea: "Upper Body",
    });
    expect(second.get("workout-1")).toEqual({
      title: "Push Day",
      targetArea: "Upper Body",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(cache.get("global:workoutMeta:workout-1")?.data).toEqual({
      title: "Push Day",
      targetArea: "Upper Body",
    });
  });
});
