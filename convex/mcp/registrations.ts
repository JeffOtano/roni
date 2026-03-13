import type {
  PromptDefinition,
  PromptHandler,
  ResourceDefinition,
  ResourceHandler,
  ToolDefinition,
  ToolHandler,
} from "./registry";
import { userToolDefinitions, userToolHandlers } from "./tools/user";
import { exerciseToolDefinitions, exerciseToolHandlers } from "./tools/exercises";
import { workoutToolDefinitions, workoutToolHandlers } from "./tools/workouts";
import { analyticsToolDefinitions, analyticsToolHandlers } from "./tools/analytics";
import { mcpResourceDefinitions, mcpResourceHandlers } from "./resources";
import { mcpPromptDefinitions, mcpPromptHandlers } from "./prompts";

export const toolDefinitions: ToolDefinition[] = [
  ...userToolDefinitions,
  ...exerciseToolDefinitions,
  ...workoutToolDefinitions,
  ...analyticsToolDefinitions,
];

export const toolHandlers: Record<string, ToolHandler> = {
  ...userToolHandlers,
  ...exerciseToolHandlers,
  ...workoutToolHandlers,
  ...analyticsToolHandlers,
};

export const resourceDefinitions: ResourceDefinition[] = mcpResourceDefinitions;
export const resourceHandlers: Record<string, ResourceHandler> = mcpResourceHandlers;

export const promptDefinitions: PromptDefinition[] = mcpPromptDefinitions;
export const promptHandlers: Record<string, PromptHandler> = mcpPromptHandlers;
