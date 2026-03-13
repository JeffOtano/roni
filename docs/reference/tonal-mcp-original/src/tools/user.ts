import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { tonal } from "../api-client.js";
import { cache, PROFILE_TTL } from "../cache.js";
import { resolveUserId } from "../user-id.js";
import type { TonalUser, StrengthScore, StrengthDistribution, MuscleReadiness } from "../types.js";

const userIdParam = z
  .string()
  .uuid()
  .optional()
  .describe("Tonal user UUID (omit to use the authenticated user)");

export function registerUserTools(server: McpServer) {
  server.tool(
    "get_user_profile",
    "Get Tonal user profile — name, stats, account info",
    { userId: userIdParam },
    async ({ userId }) => {
      const uid = await resolveUserId(userId);
      const cacheKey = `/v6/users/${uid}`;
      let user = cache.get<TonalUser>(cacheKey);
      if (!user) {
        user = await tonal.get<TonalUser>(cacheKey);
        cache.set(cacheKey, user, PROFILE_TTL);
      }
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(user, null, 2),
          },
        ],
      };
    },
  );

  server.tool(
    "get_strength_scores",
    "Get current strength scores per body region",
    { userId: userIdParam },
    async ({ userId }) => {
      const uid = await resolveUserId(userId);
      const scores = await tonal.get<StrengthScore[]>(`/v6/users/${uid}/strength-scores/current`);
      const distribution = await tonal.get<StrengthDistribution>(
        `/v6/users/${uid}/strength-scores/distribution`,
      );
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                overallScore: distribution.overallScore,
                percentile: distribution.percentile,
                bodyRegions: scores.map((s) => ({
                  region: s.bodyRegionDisplay,
                  score: s.score,
                })),
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.tool(
    "get_muscle_readiness",
    "Get current muscle recovery/readiness status per muscle group (0-100 scale)",
    { userId: userIdParam },
    async ({ userId }) => {
      const uid = await resolveUserId(userId);
      const readiness = await tonal.get<MuscleReadiness>(
        `/v6/users/${uid}/muscle-readiness/current`,
      );
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(readiness, null, 2),
          },
        ],
      };
    },
  );
}
