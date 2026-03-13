import type { ActionCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

/** Schema definition for a single tool parameter, serialized as JSON Schema. */
export interface ToolParamSchema {
  type: string;
  description?: string;
  items?: ToolParamSchema;
  enum?: string[];
  default?: unknown;
  minimum?: number;
  maximum?: number;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, ToolParamSchema>;
    required?: string[];
  };
}

export interface ResourceDefinition {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

export interface PromptDefinition {
  name: string;
  description: string;
  arguments: Array<{
    name: string;
    description: string;
    required?: boolean;
  }>;
}

export interface ToolContext {
  ctx: ActionCtx;
  userId: Id<"users">;
}

export type ToolHandler = (
  toolCtx: ToolContext,
  args: Record<string, unknown>,
) => Promise<{ content: Array<{ type: "text"; text: string }> }>;

export type ResourceHandler = (
  toolCtx: ToolContext,
  uri: string,
) => Promise<{
  contents: Array<{ uri: string; mimeType: string; text: string }>;
}>;

export type PromptHandler = (params: Record<string, string>) => Promise<{
  messages: Array<{ role: "user"; content: { type: "text"; text: string } }>;
}>;
