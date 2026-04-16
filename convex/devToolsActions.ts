"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { TonalApiError, tonalFetch } from "./tonal/client";
import { cachedFetch } from "./tonal/proxy";
import { withTokenRetry } from "./tonal/tokenRetry";
import { expandBlocksToSets } from "./tonal/transforms";
import type { BlockInput } from "./tonal/transforms";
import type { Id } from "./_generated/dataModel";
import { rateLimiter } from "./rateLimits";

// ---------------------------------------------------------------------------
// Panel 1: API Explorer
// ---------------------------------------------------------------------------

const ENDPOINT_ALLOWLIST = [
  "profile",
  "strengthScores",
  "strengthDistribution",
  "strengthHistory",
  "muscleReadiness",
  "workoutActivities",
  "workoutDetail",
  "customWorkouts",
  "externalActivities",
  "formattedSummary",
] as const;

type EndpointName = (typeof ENDPOINT_ALLOWLIST)[number];

function buildPath(
  endpoint: EndpointName,
  tonalUserId: string,
  params?: { id?: string; offset?: number; limit?: number },
): string {
  switch (endpoint) {
    case "profile":
      return `/v6/users/${tonalUserId}`;
    case "strengthScores":
      return `/v6/users/${tonalUserId}/strength-scores/current`;
    case "strengthDistribution":
      return `/v6/users/${tonalUserId}/strength-scores/distribution`;
    case "strengthHistory":
      return `/v6/users/${tonalUserId}/strength-scores/history?limit=200`;
    case "muscleReadiness":
      return `/v6/users/${tonalUserId}/muscle-readiness/current`;
    case "workoutActivities": {
      const offset = params?.offset ?? 0;
      const limit = params?.limit ?? 20;
      return `/v6/users/${tonalUserId}/workout-activities?offset=${offset}&limit=${limit}`;
    }
    case "workoutDetail":
      if (!params?.id) throw new Error("activityId required for workoutDetail");
      return `/v6/users/${tonalUserId}/workout-activities/${params.id}`;
    case "customWorkouts":
      return `/v6/user-workouts`;
    case "externalActivities":
      return `/v6/users/${tonalUserId}/external-activities?limit=${params?.limit ?? 20}`;
    case "formattedSummary":
      if (!params?.id) throw new Error("summaryId required for formattedSummary");
      return `/v6/formatted/users/${tonalUserId}/workout-summaries/${params.id}`;
  }
}

export const callTonalEndpoint = action({
  args: {
    endpoint: v.string(),
    raw: v.boolean(),
    params: v.optional(
      v.object({
        id: v.optional(v.string()),
        offset: v.optional(v.number()),
        limit: v.optional(v.number()),
      }),
    ),
  },
  handler: async (
    ctx,
    { endpoint, raw, params },
  ): Promise<{
    status: number;
    data: unknown;
    timing: number;
    source: "api" | "cache";
  }> => {
    const userId = await ctx.runQuery(internal.lib.auth.resolveEffectiveUserId, {});
    if (!userId) throw new Error("Not authenticated");

    await rateLimiter.limit(ctx, "refreshTonalData", { key: userId, throws: true });

    if (!ENDPOINT_ALLOWLIST.includes(endpoint as EndpointName)) {
      throw new Error(`Unknown endpoint: ${endpoint}`);
    }
    const ep = endpoint as EndpointName;

    const startMs = Date.now();

    try {
      const result = await withTokenRetry(ctx, userId, async (token, tonalUserId) => {
        const path = buildPath(ep, tonalUserId, params);

        if (raw) {
          const data = await tonalFetch(token, path);
          return { data, source: "api" as const };
        }

        const data = await cachedFetch(ctx, {
          userId,
          dataType: ep === "workoutDetail" ? `workoutDetail:${params?.id}` : ep,
          ttl: 60 * 1000,
          fetcher: () => tonalFetch(token, path),
        });
        return { data, source: "cache" as const };
      });

      return {
        status: 200,
        data: result.data,
        timing: Date.now() - startMs,
        source: result.source,
      };
    } catch (error) {
      const status = error instanceof TonalApiError ? error.status : 500;
      const message = error instanceof Error ? error.message : String(error);
      return {
        status,
        data: { error: message },
        timing: Date.now() - startMs,
        source: "api" as const,
      };
    }
  },
});

// ---------------------------------------------------------------------------
// Panel 4: Workout Push Debugger - Payload Reconstruction
// ---------------------------------------------------------------------------

export const reconstructPushPayload = action({
  args: { planId: v.id("workoutPlans") },
  handler: async (
    ctx,
    { planId },
  ): Promise<{
    title: string;
    sets: Record<string, unknown>[];
    createdSource: string;
    setCount: number;
    movementIds: string[];
  }> => {
    const userId = (await ctx.runQuery(
      internal.lib.auth.resolveEffectiveUserId,
      {},
    )) as Id<"users"> | null;
    if (!userId) throw new Error("Not authenticated");

    const plan = (await ctx.runQuery(internal.devTools.getPlanForReconstruction, {
      planId,
      userId,
    })) as { title: string; blocks: BlockInput[] } | null;
    if (!plan) throw new Error("Workout plan not found or not owned by user");

    const catalog = await ctx.runQuery(internal.tonal.movementSync.getAllMovements);
    const sets = expandBlocksToSets(plan.blocks, catalog);

    const cleanSets = sets.map((s) =>
      Object.fromEntries(Object.entries(s).filter(([, val]) => val !== undefined)),
    );

    return {
      title: plan.title,
      sets: cleanSets,
      createdSource: "WorkoutBuilder",
      setCount: cleanSets.length,
      movementIds: [...new Set(cleanSets.map((s) => s.movementId as string))],
    };
  },
});
