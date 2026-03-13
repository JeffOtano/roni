import type {
  PromptDefinition,
  PromptHandler,
  ResourceDefinition,
  ResourceHandler,
  ToolDefinition,
  ToolHandler,
} from "./registry";

export const toolDefinitions: ToolDefinition[] = [];
export const toolHandlers: Record<string, ToolHandler> = {};

export const resourceDefinitions: ResourceDefinition[] = [];
export const resourceHandlers: Record<string, ResourceHandler> = {};

export const promptDefinitions: PromptDefinition[] = [];
export const promptHandlers: Record<string, PromptHandler> = {};
