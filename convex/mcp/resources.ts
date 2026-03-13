import type { ResourceDefinition, ResourceHandler, ToolContext } from "./registry";
import { internal } from "../_generated/api";

async function readExercises(toolCtx: ToolContext, uri: string): ReturnType<ResourceHandler> {
  const movements = await toolCtx.ctx.runAction(internal.tonal.proxy.fetchMovements, {
    userId: toolCtx.userId,
  });
  const summary = movements.map(
    (m: {
      id: string;
      name: string;
      muscleGroups: string[];
      onMachine: boolean;
      skillLevel: number;
    }) => ({
      id: m.id,
      name: m.name,
      muscleGroups: m.muscleGroups,
      onMachine: m.onMachine,
      skillLevel: m.skillLevel,
    }),
  );
  return {
    contents: [{ uri, mimeType: "application/json", text: JSON.stringify(summary, null, 2) }],
  };
}

async function readUserProfile(toolCtx: ToolContext, uri: string): ReturnType<ResourceHandler> {
  const [profile, scores] = await Promise.all([
    toolCtx.ctx.runAction(internal.tonal.proxy.fetchUserProfile, {
      userId: toolCtx.userId,
    }),
    toolCtx.ctx.runAction(internal.tonal.proxy.fetchStrengthScores, {
      userId: toolCtx.userId,
    }),
  ]);
  const result = {
    ...profile,
    strengthScores: scores.map((s: { bodyRegionDisplay: string; score: number }) => ({
      region: s.bodyRegionDisplay,
      score: s.score,
    })),
  };
  return {
    contents: [{ uri, mimeType: "application/json", text: JSON.stringify(result, null, 2) }],
  };
}

async function readMuscleReadiness(toolCtx: ToolContext, uri: string): ReturnType<ResourceHandler> {
  const readiness = await toolCtx.ctx.runAction(internal.tonal.proxy.fetchMuscleReadiness, {
    userId: toolCtx.userId,
  });
  return {
    contents: [{ uri, mimeType: "application/json", text: JSON.stringify(readiness, null, 2) }],
  };
}

export const mcpResourceDefinitions: ResourceDefinition[] = [
  {
    uri: "tonal://exercises",
    name: "exercises",
    description: "Full Tonal movement library with IDs, names, and muscle groups",
    mimeType: "application/json",
  },
  {
    uri: "tonal://user-profile",
    name: "user-profile",
    description: "User profile with strength scores snapshot",
    mimeType: "application/json",
  },
  {
    uri: "tonal://muscle-readiness",
    name: "muscle-readiness",
    description: "Current muscle recovery/readiness per group (0-100)",
    mimeType: "application/json",
  },
];

export const mcpResourceHandlers: Record<string, ResourceHandler> = {
  "tonal://exercises": readExercises,
  "tonal://user-profile": readUserProfile,
  "tonal://muscle-readiness": readMuscleReadiness,
};
