import type { ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { hashApiKey } from "./crypto";

// Error codes — will be imported from protocol.ts after Task 6
const UNAUTHORIZED = -32000;
const TONAL_NOT_CONNECTED = -32001;

export interface McpAuthResult {
  userId: Id<"users">;
  keyId: Id<"mcpApiKeys">;
  userProfile: Doc<"userProfiles">;
}

export class McpAuthError extends Error {
  constructor(
    message: string,
    public code: number,
  ) {
    super(message);
    this.name = "McpAuthError";
  }
}

/** Extract the bearer token from an Authorization header value. */
export function extractBearerToken(header: string | null | undefined): string | null {
  if (!header) return null;
  const match = header.match(/^Bearer\s+(\S+)$/);
  return match?.[1] ?? null;
}

/** Validate an MCP API key and return the authenticated context. */
export async function authenticateMcpRequest(
  ctx: ActionCtx,
  authHeader: string | null | undefined,
): Promise<McpAuthResult> {
  const token = extractBearerToken(authHeader);
  if (!token) {
    throw new McpAuthError("Missing or invalid API key", UNAUTHORIZED);
  }

  const keyHash = await hashApiKey(token);

  const keyRow: Doc<"mcpApiKeys"> | null = await ctx.runQuery(
    internal.mcp.auth_queries.getKeyByHash,
    { keyHash },
  );
  if (!keyRow) {
    throw new McpAuthError("Invalid API key", UNAUTHORIZED);
  }

  await ctx.runMutation(internal.mcp.auth_queries.updateKeyLastUsed, {
    keyId: keyRow._id,
  });

  const profile: Doc<"userProfiles"> | null = await ctx.runQuery(
    internal.mcp.auth_queries.getUserProfileByUserId,
    { userId: keyRow.userId },
  );
  if (!profile || !profile.tonalToken) {
    throw new McpAuthError(
      "Tonal account not connected. Connect at tonal.coach/connect-tonal",
      TONAL_NOT_CONNECTED,
    );
  }

  return {
    userId: keyRow.userId,
    keyId: keyRow._id,
    userProfile: profile,
  };
}
