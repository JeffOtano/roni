import type { ToolContext, ToolDefinition, ToolHandler } from "../registry";
import { internal } from "../../_generated/api";

async function getUserProfile(
  toolCtx: ToolContext,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const profile = await toolCtx.ctx.runAction(internal.tonal.proxy.fetchUserProfile, {
    userId: toolCtx.userId,
  });
  return {
    content: [{ type: "text", text: JSON.stringify(profile, null, 2) }],
  };
}

async function getStrengthScores(
  toolCtx: ToolContext,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const [scores, distribution] = await Promise.all([
    toolCtx.ctx.runAction(internal.tonal.proxy.fetchStrengthScores, {
      userId: toolCtx.userId,
    }),
    toolCtx.ctx.runAction(internal.tonal.proxy.fetchStrengthDistribution, {
      userId: toolCtx.userId,
    }),
  ]);
  const result = {
    overallScore: distribution.overallScore,
    percentile: distribution.percentile,
    bodyRegions: scores.map((s: { bodyRegionDisplay: string; score: number }) => ({
      region: s.bodyRegionDisplay,
      score: s.score,
    })),
  };
  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
  };
}

async function getMuscleReadiness(
  toolCtx: ToolContext,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const readiness = await toolCtx.ctx.runAction(internal.tonal.proxy.fetchMuscleReadiness, {
    userId: toolCtx.userId,
  });
  return {
    content: [{ type: "text", text: JSON.stringify(readiness, null, 2) }],
  };
}

export const userToolDefinitions: ToolDefinition[] = [
  {
    name: "get_user_profile",
    description: "Get Tonal user profile — name, stats, account info",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_strength_scores",
    description: "Get current strength scores per body region with percentile",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_muscle_readiness",
    description: "Get current muscle recovery/readiness status per muscle group (0-100 scale)",
    inputSchema: { type: "object", properties: {} },
  },
];

export const userToolHandlers: Record<string, ToolHandler> = {
  get_user_profile: (tc) => getUserProfile(tc),
  get_strength_scores: (tc) => getStrengthScores(tc),
  get_muscle_readiness: (tc) => getMuscleReadiness(tc),
};
