# MCP Integration Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Embed a full MCP server inside the Convex backend so any tonal-coach user can connect Claude Desktop/Code to their Tonal data via API key.

**Architecture:** Stateless JSON-RPC dispatcher as a Convex HTTP action at `POST /mcp`. Multi-key auth via `mcpApiKeys` table. Usage tracking via `mcpUsage` table. 16 MCP tools wrap existing Convex actions (with 3 new analytics actions). Settings UI for key management.

> **Note:** The spec says "15 tools" in Section 2 but lists 16 in the detail tables (3+3+4+6). The correct count is **16**. The spec has a typo.

**Tech Stack:** Convex (HTTP actions, mutations, queries), TypeScript, Zod, Next.js (React), Tailwind CSS, shadcn/ui, Vitest

**Spec:** `docs/superpowers/specs/2026-03-13-mcp-integration-design.md`

---

## Chunk 1: Schema + Key Management + Auth

### Task 1: Add schema tables

**Files:**

- Modify: `convex/schema.ts`

- [ ] **Step 1: Add `mcpApiKeys` and `mcpUsage` tables to schema**

Add after the `progressPhotos` table definition in `convex/schema.ts`:

```typescript
/** MCP API keys for Claude Desktop/Code integration. */
mcpApiKeys: defineTable({
  userId: v.id("users"),
  keyHash: v.string(),
  label: v.optional(v.string()),
  createdAt: v.number(),
  lastUsedAt: v.optional(v.number()),
})
  .index("by_keyHash", ["keyHash"])
  .index("by_userId", ["userId"]),

/** MCP usage tracking for analytics. */
mcpUsage: defineTable({
  userId: v.id("users"),
  keyId: v.id("mcpApiKeys"),
  tool: v.string(),
  calledAt: v.number(),
})
  .index("by_userId", ["userId"])
  .index("by_userId_calledAt", ["userId", "calledAt"]),
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (new tables are additive)

- [ ] **Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "feat: add mcpApiKeys and mcpUsage schema tables"
```

---

### Task 2: Key management mutations and query

**Files:**

- Create: `convex/mcp/crypto.ts` (shared utility — Web Crypto, no `node:crypto`)
- Create: `convex/mcp/keys.ts`
- Test: `convex/mcp/keys.test.ts`

> **Important:** Convex's default V8 runtime does NOT support `node:crypto`. Use Web Crypto API (`crypto.subtle`, `crypto.getRandomValues`) to match existing project patterns (see `convex/tonal/encryption.ts`). The crypto utilities live in a separate `crypto.ts` so they can be imported from both mutations (`keys.ts`) and actions (`auth.ts`).

- [ ] **Step 1: Write failing tests for crypto utilities**

Create `convex/mcp/keys.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { hashApiKey, generateKeyString } from "./crypto";

describe("hashApiKey", () => {
  it("produces consistent SHA-256 hex digest", async () => {
    const hash1 = await hashApiKey("test-key-123");
    const hash2 = await hashApiKey("test-key-123");
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces different hashes for different keys", async () => {
    const hash1 = await hashApiKey("key-a");
    const hash2 = await hashApiKey("key-b");
    expect(hash1).not.toBe(hash2);
  });
});

describe("generateKeyString", () => {
  it("returns a base64url string of 43 characters", () => {
    const key = generateKeyString();
    // 32 bytes base64url-encoded = 43 characters (no padding)
    expect(key.length).toBe(43);
    expect(key).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("generates unique keys", () => {
    const keys = new Set(Array.from({ length: 10 }, () => generateKeyString()));
    expect(keys.size).toBe(10);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run convex/mcp/keys.test.ts`
Expected: FAIL — `hashApiKey` and `generateKeyString` not found

- [ ] **Step 3: Create crypto utility (Web Crypto API)**

Create `convex/mcp/crypto.ts`:

```typescript
/** SHA-256 hash of a plaintext API key, returned as hex. Uses Web Crypto API. */
export async function hashApiKey(plaintext: string): Promise<string> {
  const encoded = new TextEncoder().encode(plaintext);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Generate a cryptographically random base64url key string (32 bytes). */
export function generateKeyString(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  // Manual base64url encoding (no padding)
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}
```

- [ ] **Step 4: Implement Convex key management functions**

Create `convex/mcp/keys.ts`:

```typescript
import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { hashApiKey, generateKeyString } from "./crypto";

export const generateMcpApiKey = mutation({
  args: { label: v.optional(v.string()) },
  handler: async (ctx, { label }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const plaintext = generateKeyString();
    const keyHash = await hashApiKey(plaintext);

    await ctx.db.insert("mcpApiKeys", {
      userId,
      keyHash,
      label,
      createdAt: Date.now(),
    });

    return { key: plaintext };
  },
});

export const revokeMcpApiKey = mutation({
  args: { keyId: v.id("mcpApiKeys") },
  handler: async (ctx, { keyId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const keyRow = await ctx.db.get(keyId);
    if (!keyRow || keyRow.userId !== userId) {
      throw new Error("Key not found or not owned by you");
    }

    await ctx.db.delete(keyId);
    return { revoked: true };
  },
});

export const listMcpApiKeys = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const keys = await ctx.db
      .query("mcpApiKeys")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    return keys.map((k) => ({
      _id: k._id,
      label: k.label ?? null,
      createdAt: k.createdAt,
      lastUsedAt: k.lastUsedAt ?? null,
    }));
  },
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run convex/mcp/keys.test.ts`
Expected: PASS

- [ ] **Step 5: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add convex/mcp/crypto.ts convex/mcp/keys.ts convex/mcp/keys.test.ts
git commit -m "feat: add MCP API key generation, revocation, and listing"
```

---

### Task 3: MCP auth module

**Files:**

- Create: `convex/mcp/auth.ts`
- Test: `convex/mcp/auth.test.ts`

- [ ] **Step 1: Write failing tests for auth validation**

Create `convex/mcp/auth.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { extractBearerToken } from "./auth";

describe("extractBearerToken", () => {
  it("extracts token from valid Authorization header", () => {
    expect(extractBearerToken("Bearer abc123")).toBe("abc123");
  });

  it("returns null for missing header", () => {
    expect(extractBearerToken(null)).toBeNull();
    expect(extractBearerToken(undefined)).toBeNull();
  });

  it("returns null for non-Bearer scheme", () => {
    expect(extractBearerToken("Basic abc123")).toBeNull();
  });

  it("returns null for empty Bearer value", () => {
    expect(extractBearerToken("Bearer ")).toBeNull();
    expect(extractBearerToken("Bearer")).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run convex/mcp/auth.test.ts`
Expected: FAIL — `extractBearerToken` not found

- [ ] **Step 3: Implement auth module**

Create `convex/mcp/auth.ts`:

```typescript
import type { ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id, Doc } from "../_generated/dataModel";
import { hashApiKey } from "./crypto";
import { UNAUTHORIZED, TONAL_NOT_CONNECTED } from "./protocol";

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

  // Update lastUsedAt — awaited so Convex runtime schedules it properly
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
```

> **Note:** `auth.ts` imports from `./protocol` (Task 6, Chunk 2). At typecheck time in this chunk, `protocol.ts` doesn't exist yet. The executor should create a minimal stub or defer typecheck to after Chunk 2 Task 6. Alternatively, inline the constants `-32000` and `-32001` initially and refactor to imports in Task 6.

- [ ] **Step 4: Create internal queries for auth lookups**

Create `convex/mcp/auth_queries.ts`:

```typescript
import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";

export const getKeyByHash = internalQuery({
  args: { keyHash: v.string() },
  handler: async (ctx, { keyHash }) => {
    return ctx.db
      .query("mcpApiKeys")
      .withIndex("by_keyHash", (q) => q.eq("keyHash", keyHash))
      .first();
  },
});

export const getUserProfileByUserId = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
  },
});

export const updateKeyLastUsed = internalMutation({
  args: { keyId: v.id("mcpApiKeys") },
  handler: async (ctx, { keyId }) => {
    await ctx.db.patch(keyId, { lastUsedAt: Date.now() });
  },
});
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run convex/mcp/auth.test.ts`
Expected: PASS

- [ ] **Step 6: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add convex/mcp/auth.ts convex/mcp/auth.test.ts convex/mcp/auth_queries.ts
git commit -m "feat: add MCP request authentication with API key validation"
```

---

### Task 4: Usage tracking mutation

**Files:**

- Create: `convex/mcp/usage.ts`

- [ ] **Step 1: Create usage logging mutation**

Create `convex/mcp/usage.ts`:

```typescript
import { v } from "convex/values";
import { internalMutation } from "../_generated/server";

export const logMcpUsage = internalMutation({
  args: {
    userId: v.id("users"),
    keyId: v.id("mcpApiKeys"),
    tool: v.string(),
  },
  handler: async (ctx, { userId, keyId, tool }) => {
    await ctx.db.insert("mcpUsage", {
      userId,
      keyId,
      tool,
      calledAt: Date.now(),
    });
  },
});
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add convex/mcp/usage.ts
git commit -m "feat: add MCP usage tracking mutation"
```

---

### Task 5: Rate limiting for MCP

**Files:**

- Modify: `convex/rateLimits.ts`

- [ ] **Step 1: Add MCP rate limit config**

Add to the `RateLimiter` constructor in `convex/rateLimits.ts`:

```typescript
mcpRequest: {
  kind: "token bucket",
  rate: 30,
  period: MINUTE,
  capacity: 10,
},
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add convex/rateLimits.ts
git commit -m "feat: add MCP request rate limiting"
```

---

## Chunk 2: JSON-RPC Dispatcher + HTTP Route

### Task 6: JSON-RPC protocol types and error helpers

**Files:**

- Create: `convex/mcp/protocol.ts`
- Test: `convex/mcp/protocol.test.ts`

- [ ] **Step 1: Write failing tests for protocol helpers**

Create `convex/mcp/protocol.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  jsonRpcError,
  jsonRpcSuccess,
  parseJsonRpcRequest,
  INVALID_REQUEST,
  METHOD_NOT_FOUND,
} from "./protocol";

describe("jsonRpcSuccess", () => {
  it("wraps result in JSON-RPC 2.0 response", () => {
    const resp = jsonRpcSuccess(1, { tools: [] });
    expect(resp).toEqual({
      jsonrpc: "2.0",
      id: 1,
      result: { tools: [] },
    });
  });
});

describe("jsonRpcError", () => {
  it("wraps error in JSON-RPC 2.0 error response", () => {
    const resp = jsonRpcError(1, INVALID_REQUEST, "bad request");
    expect(resp).toEqual({
      jsonrpc: "2.0",
      id: 1,
      error: { code: -32600, message: "bad request" },
    });
  });
});

describe("parseJsonRpcRequest", () => {
  it("parses valid request", () => {
    const req = parseJsonRpcRequest({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
    });
    expect(req).toEqual({ jsonrpc: "2.0", id: 1, method: "tools/list" });
  });

  it("returns null for missing method", () => {
    expect(parseJsonRpcRequest({ jsonrpc: "2.0", id: 1 })).toBeNull();
  });

  it("returns null for wrong jsonrpc version", () => {
    expect(parseJsonRpcRequest({ jsonrpc: "1.0", id: 1, method: "test" })).toBeNull();
  });

  it("handles notifications (no id)", () => {
    const req = parseJsonRpcRequest({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    });
    expect(req).toEqual({
      jsonrpc: "2.0",
      id: undefined,
      method: "notifications/initialized",
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run convex/mcp/protocol.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement protocol helpers**

Create `convex/mcp/protocol.ts`:

```typescript
// JSON-RPC 2.0 error codes
export const PARSE_ERROR = -32700;
export const INVALID_REQUEST = -32600;
export const METHOD_NOT_FOUND = -32601;
export const INVALID_PARAMS = -32602;
export const INTERNAL_ERROR = -32603;
export const UNAUTHORIZED = -32000;
export const TONAL_NOT_CONNECTED = -32001;

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: number | string;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number | string | null;
  result?: unknown;
  error?: { code: number; message: string };
}

export function jsonRpcSuccess(
  id: number | string | null | undefined,
  result: unknown,
): JsonRpcResponse {
  return { jsonrpc: "2.0", id: id ?? null, result };
}

export function jsonRpcError(
  id: number | string | null | undefined,
  code: number,
  message: string,
): JsonRpcResponse {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

/** Parse and validate a JSON-RPC 2.0 request. Returns null if invalid. */
export function parseJsonRpcRequest(body: unknown): JsonRpcRequest | null {
  if (typeof body !== "object" || body === null) return null;
  const obj = body as Record<string, unknown>;
  if (obj.jsonrpc !== "2.0") return null;
  if (typeof obj.method !== "string") return null;
  return {
    jsonrpc: "2.0",
    id: obj.id as number | string | undefined,
    method: obj.method,
    params: obj.params as Record<string, unknown> | undefined,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run convex/mcp/protocol.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add convex/mcp/protocol.ts convex/mcp/protocol.test.ts
git commit -m "feat: add JSON-RPC 2.0 protocol types and helpers"
```

---

### Task 7: Tool registry type definitions

**Files:**

- Create: `convex/mcp/registry.ts`

- [ ] **Step 1: Create the tool/resource/prompt registry types**

Create `convex/mcp/registry.ts`:

```typescript
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
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add convex/mcp/registry.ts
git commit -m "feat: add MCP tool/resource/prompt registry types"
```

---

### Task 8: MCP server (JSON-RPC dispatcher) + HTTP route

**Files:**

- Create: `convex/mcp/server.ts`
- Modify: `convex/http.ts`
- Test: `convex/mcp/server.test.ts`

- [ ] **Step 1: Write failing tests for the dispatcher**

Create `convex/mcp/server.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildInitializeResult, buildToolsListResult } from "./server";

describe("buildInitializeResult", () => {
  it("returns server info and capabilities", () => {
    const result = buildInitializeResult();
    expect(result.protocolVersion).toBe("2025-03-26");
    expect(result.serverInfo.name).toBe("tonal-coach");
    expect(result.capabilities).toHaveProperty("tools");
    expect(result.capabilities).toHaveProperty("resources");
    expect(result.capabilities).toHaveProperty("prompts");
  });
});

describe("buildToolsListResult", () => {
  // Initially 0 tools (stub registrations). Updated to 16 after Task 15.
  it("returns tool definitions array", () => {
    const result = buildToolsListResult();
    expect(result.tools).toBeInstanceOf(Array);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run convex/mcp/server.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement MCP server dispatcher**

Create `convex/mcp/server.ts`. This is the core dispatcher — it imports tool/resource/prompt registries (which will be created in later tasks) and routes JSON-RPC methods:

```typescript
import { httpAction } from "../_generated/server";
import {
  parseJsonRpcRequest,
  jsonRpcSuccess,
  jsonRpcError,
  PARSE_ERROR,
  INVALID_REQUEST,
  METHOD_NOT_FOUND,
  INTERNAL_ERROR,
  INVALID_PARAMS,
  UNAUTHORIZED,
} from "./protocol";
import { authenticateMcpRequest, McpAuthError } from "./auth";
import { internal } from "../_generated/api";
import { rateLimiter } from "../rateLimits";
import {
  toolDefinitions,
  toolHandlers,
  resourceDefinitions,
  resourceHandlers,
  promptDefinitions,
  promptHandlers,
} from "./registrations";

export function buildInitializeResult() {
  return {
    protocolVersion: "2025-03-26",
    serverInfo: { name: "tonal-coach", version: "1.0.0" },
    capabilities: {
      tools: { listChanged: false },
      resources: { subscribe: false, listChanged: false },
      prompts: { listChanged: false },
    },
  };
}

export function buildToolsListResult() {
  return { tools: toolDefinitions };
}

export const mcpHandler = httpAction(async (ctx, request) => {
  // Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(jsonRpcError(null, PARSE_ERROR, "Invalid JSON"));
  }

  const rpc = parseJsonRpcRequest(body);
  if (!rpc) {
    return jsonResponse(jsonRpcError(null, INVALID_REQUEST, "Invalid JSON-RPC request"));
  }

  // Notifications — HTTP requires a response, so return 204 No Content
  if (rpc.method === "notifications/initialized") {
    return new Response(null, { status: 204 });
  }

  if (rpc.method === "ping") {
    return jsonResponse(jsonRpcSuccess(rpc.id, {}));
  }

  // Initialize doesn't need auth
  if (rpc.method === "initialize") {
    return jsonResponse(jsonRpcSuccess(rpc.id, buildInitializeResult()));
  }

  // Everything else needs auth
  let auth;
  try {
    auth = await authenticateMcpRequest(ctx, request.headers.get("authorization"));
  } catch (e) {
    if (e instanceof McpAuthError) {
      return jsonResponse(jsonRpcError(rpc.id, e.code, e.message));
    }
    return jsonResponse(jsonRpcError(rpc.id, INTERNAL_ERROR, "Auth failed"));
  }

  // Rate limit by userId
  const { ok } = await rateLimiter.limit(ctx, "mcpRequest", {
    key: auth.userId,
    throws: false,
  });
  if (!ok) {
    return jsonResponse(
      jsonRpcError(rpc.id, UNAUTHORIZED, "Rate limit exceeded. Try again shortly."),
    );
  }

  const toolCtx = { ctx, userId: auth.userId };

  try {
    switch (rpc.method) {
      case "tools/list":
        return jsonResponse(jsonRpcSuccess(rpc.id, buildToolsListResult()));

      case "tools/call": {
        const name = rpc.params?.name as string | undefined;
        if (!name) {
          return jsonResponse(jsonRpcError(rpc.id, INVALID_PARAMS, "Missing tool name"));
        }
        const handler = toolHandlers[name];
        if (!handler) {
          return jsonResponse(jsonRpcError(rpc.id, METHOD_NOT_FOUND, `Unknown tool: ${name}`));
        }
        const args = (rpc.params?.arguments ?? {}) as Record<string, unknown>;
        const result = await handler(toolCtx, args);

        // Log usage (fire-and-forget)
        void ctx.runMutation(internal.mcp.usage.logMcpUsage, {
          userId: auth.userId,
          keyId: auth.keyId,
          tool: name,
        });

        return jsonResponse(jsonRpcSuccess(rpc.id, result));
      }

      case "resources/list":
        return jsonResponse(jsonRpcSuccess(rpc.id, { resources: resourceDefinitions }));

      case "resources/read": {
        const uri = rpc.params?.uri as string | undefined;
        if (!uri) {
          return jsonResponse(jsonRpcError(rpc.id, INVALID_PARAMS, "Missing resource URI"));
        }
        const resHandler = resourceHandlers[uri];
        if (!resHandler) {
          return jsonResponse(jsonRpcError(rpc.id, METHOD_NOT_FOUND, `Unknown resource: ${uri}`));
        }
        const result = await resHandler(toolCtx, uri);

        void ctx.runMutation(internal.mcp.usage.logMcpUsage, {
          userId: auth.userId,
          keyId: auth.keyId,
          tool: `resource:${uri}`,
        });

        return jsonResponse(jsonRpcSuccess(rpc.id, result));
      }

      case "prompts/list":
        return jsonResponse(jsonRpcSuccess(rpc.id, { prompts: promptDefinitions }));

      case "prompts/get": {
        const promptName = rpc.params?.name as string | undefined;
        if (!promptName) {
          return jsonResponse(jsonRpcError(rpc.id, INVALID_PARAMS, "Missing prompt name"));
        }
        const pHandler = promptHandlers[promptName];
        if (!pHandler) {
          return jsonResponse(
            jsonRpcError(rpc.id, METHOD_NOT_FOUND, `Unknown prompt: ${promptName}`),
          );
        }
        const args = (rpc.params?.arguments ?? {}) as Record<string, string>;
        const result = await pHandler(args);

        void ctx.runMutation(internal.mcp.usage.logMcpUsage, {
          userId: auth.userId,
          keyId: auth.keyId,
          tool: `prompt:${promptName}`,
        });

        return jsonResponse(jsonRpcSuccess(rpc.id, result));
      }

      default:
        return jsonResponse(
          jsonRpcError(rpc.id, METHOD_NOT_FOUND, `Unknown method: ${rpc.method}`),
        );
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Internal error";
    return jsonResponse(jsonRpcError(rpc.id, INTERNAL_ERROR, message));
  }
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
```

- [ ] **Step 4: Create stub registrations file**

Create `convex/mcp/registrations.ts` with empty registries (tools will be populated in later tasks):

```typescript
import type {
  ToolDefinition,
  ToolHandler,
  ResourceDefinition,
  ResourceHandler,
  PromptDefinition,
  PromptHandler,
} from "./registry";

export const toolDefinitions: ToolDefinition[] = [];
export const toolHandlers: Record<string, ToolHandler> = {};

export const resourceDefinitions: ResourceDefinition[] = [];
export const resourceHandlers: Record<string, ResourceHandler> = {};

export const promptDefinitions: PromptDefinition[] = [];
export const promptHandlers: Record<string, PromptHandler> = {};
```

- [ ] **Step 5: Register HTTP route**

Modify `convex/http.ts` — add the import and route registration (keep existing auth routes):

Add import at top:

```typescript
import { mcpHandler } from "./mcp/server";
```

Add before `export default http;`:

```typescript
http.route({
  path: "/mcp",
  method: "POST",
  handler: mcpHandler,
});
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run convex/mcp/server.test.ts`
Expected: PASS

- [ ] **Step 7: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add convex/mcp/server.ts convex/mcp/server.test.ts convex/mcp/registrations.ts convex/http.ts
git commit -m "feat: add MCP JSON-RPC dispatcher and HTTP route"
```

---

## Chunk 3: MCP Tool Implementations

### Task 9: User tools (3 tools)

**Files:**

- Create: `convex/mcp/tools/user.ts`

- [ ] **Step 1: Implement user tools**

Create `convex/mcp/tools/user.ts`:

```typescript
import type { ToolDefinition, ToolHandler, ToolContext } from "../registry";
import { internal } from "../../_generated/api";

async function getUserProfile(
  toolCtx: ToolContext,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const profile = await toolCtx.ctx.runAction(internal.tonal.proxy.fetchUserProfile, {
    userId: toolCtx.userId,
  });
  return { content: [{ type: "text", text: JSON.stringify(profile, null, 2) }] };
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
  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
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
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add convex/mcp/tools/user.ts
git commit -m "feat: add MCP user tools (profile, strength, readiness)"
```

---

### Task 10: Exercise tools (3 tools)

**Files:**

- Create: `convex/mcp/tools/exercises.ts`

- [ ] **Step 1: Implement exercise tools**

Create `convex/mcp/tools/exercises.ts`:

```typescript
import type { ToolDefinition, ToolHandler, ToolContext } from "../registry";
import { internal } from "../../_generated/api";
import type { Movement } from "../../tonal/types";

async function fetchCachedMovements(toolCtx: ToolContext): Promise<Movement[]> {
  return toolCtx.ctx.runAction(internal.tonal.proxy.fetchMovements, {
    userId: toolCtx.userId,
  });
}

async function listMovements(
  toolCtx: ToolContext,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const movements = await fetchCachedMovements(toolCtx);
  const summary = movements.map((m) => ({
    id: m.id,
    name: m.name,
    muscleGroups: m.muscleGroups,
    onMachine: m.onMachine,
    skillLevel: m.skillLevel,
  }));
  return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] };
}

async function searchMovements(
  toolCtx: ToolContext,
  args: Record<string, unknown>,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  let movements = await fetchCachedMovements(toolCtx);
  const name = args.name as string | undefined;
  const muscleGroup = args.muscleGroup as string | undefined;
  const onMachine = args.onMachine as boolean | undefined;

  if (name) {
    const lower = name.toLowerCase();
    movements = movements.filter((m) => m.name.toLowerCase().includes(lower));
  }
  if (muscleGroup) {
    const lower = muscleGroup.toLowerCase();
    movements = movements.filter((m) =>
      m.muscleGroups.some((g) => typeof g === "string" && g.toLowerCase().includes(lower)),
    );
  }
  if (onMachine !== undefined) {
    movements = movements.filter((m) => m.onMachine === onMachine);
  }

  const results = movements.map((m) => ({
    id: m.id,
    name: m.name,
    muscleGroups: m.muscleGroups,
    onMachine: m.onMachine,
    skillLevel: m.skillLevel,
    descriptionHow: m.descriptionHow,
  }));

  return {
    content: [
      {
        type: "text",
        text:
          results.length > 0
            ? JSON.stringify(results, null, 2)
            : "No movements found matching the criteria.",
      },
    ],
  };
}

async function getMovementsById(
  toolCtx: ToolContext,
  args: Record<string, unknown>,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const movementIds = args.movementIds as string[];
  const movements = await fetchCachedMovements(toolCtx);
  const byId = new Map(movements.map((m) => [m.id, m]));

  const results = movementIds.map((id) => {
    const m = byId.get(id);
    if (!m) return { id, found: false };
    return {
      id: m.id,
      name: m.name,
      muscleGroups: m.muscleGroups,
      onMachine: m.onMachine,
      skillLevel: m.skillLevel,
      found: true,
    };
  });

  return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
}

export const exerciseToolDefinitions: ToolDefinition[] = [
  {
    name: "list_movements",
    description:
      "List all Tonal exercises/movements with IDs and muscle groups. Use search_movements for filtering.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "search_movements",
    description: "Search exercises by name substring and/or muscle group",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Substring to match in exercise name (case-insensitive)",
        },
        muscleGroup: {
          type: "string",
          description: "Muscle group to filter by (e.g. Chest, Back, Quads, Shoulders)",
        },
        onMachine: {
          type: "boolean",
          description: "Filter to on-machine (true) or free-lift (false)",
        },
      },
    },
  },
  {
    name: "get_movements_by_id",
    description:
      "Look up exercises by their movement UUID. Returns name, muscle groups, and details.",
    inputSchema: {
      type: "object",
      properties: {
        movementIds: {
          type: "array",
          description: "Array of movement UUIDs to look up (1-50)",
          items: { type: "string" },
        },
      },
      required: ["movementIds"],
    },
  },
];

export const exerciseToolHandlers: Record<string, ToolHandler> = {
  list_movements: (tc) => listMovements(tc),
  search_movements: (tc, args) => searchMovements(tc, args),
  get_movements_by_id: (tc, args) => getMovementsById(tc, args),
};
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add convex/mcp/tools/exercises.ts
git commit -m "feat: add MCP exercise tools (list, search, lookup by ID)"
```

---

### Task 11: Workout tools (4 tools)

**Files:**

- Create: `convex/mcp/tools/workouts.ts`

- [ ] **Step 1: Implement workout tools**

Create `convex/mcp/tools/workouts.ts`. These wrap existing Convex actions in `tonal/mutations.ts` and `tonal/proxy.ts`:

```typescript
import type { ToolDefinition, ToolHandler, ToolContext } from "../registry";
import { internal } from "../../_generated/api";
import type { Movement } from "../../tonal/types";

async function createCustomWorkout(
  toolCtx: ToolContext,
  args: Record<string, unknown>,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const title = args.title as string;
  const blocks = args.blocks as Array<{ exercises: Array<Record<string, unknown>> }>;

  const result = await toolCtx.ctx.runAction(internal.tonal.mutations.doTonalCreateWorkout, {
    userId: toolCtx.userId,
    title,
    blocks,
  });

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          { id: result.id, title, message: `Workout "${title}" created!` },
          null,
          2,
        ),
      },
    ],
  };
}

async function estimateWorkout(
  toolCtx: ToolContext,
  args: Record<string, unknown>,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const blocks = args.blocks as Array<{ exercises: Array<Record<string, unknown>> }>;

  const result = await toolCtx.ctx.runAction(internal.tonal.mutations.estimateWorkout, {
    userId: toolCtx.userId,
    blocks,
  });

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}

async function listCustomWorkouts(
  toolCtx: ToolContext,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const [workouts, movements] = await Promise.all([
    toolCtx.ctx.runAction(internal.tonal.proxy.fetchCustomWorkouts, {
      userId: toolCtx.userId,
    }),
    toolCtx.ctx.runAction(internal.tonal.proxy.fetchMovements, {
      userId: toolCtx.userId,
    }),
  ]);

  const names = new Map((movements as Movement[]).map((m) => [m.id, m.name]));
  const summaries = workouts.map(
    (w: {
      id: string;
      title: string;
      duration: number;
      targetArea: string;
      bodyRegions: string[];
      movementIds: string[];
      createdAt: string;
    }) => ({
      id: w.id,
      title: w.title,
      durationMinutes: Math.round(w.duration / 60),
      targetArea: w.targetArea,
      bodyRegions: w.bodyRegions,
      exercises: w.movementIds?.map((id: string) => names.get(id) ?? id) ?? [],
      createdAt: w.createdAt,
    }),
  );

  return { content: [{ type: "text", text: JSON.stringify(summaries, null, 2) }] };
}

async function deleteCustomWorkout(
  toolCtx: ToolContext,
  args: Record<string, unknown>,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const workoutId = args.workoutId as string;

  await toolCtx.ctx.runAction(internal.tonal.mutations.deleteWorkout, {
    userId: toolCtx.userId,
    workoutId,
  });

  return {
    content: [{ type: "text", text: `Workout ${workoutId} deleted successfully.` }],
  };
}

const EXERCISE_SCHEMA_DESCRIPTION = `Each exercise: { movementId (UUID), sets (1-10, default 3), reps (number), duration (seconds, for timed), spotter (bool), eccentric (bool), warmUp (bool) }`;

export const workoutToolDefinitions: ToolDefinition[] = [
  {
    name: "create_custom_workout",
    description: `Create a custom workout on Tonal. Specify exercises grouped into blocks.
Each block contains 1+ exercises. Multiple exercises in a block = superset.
${EXERCISE_SCHEMA_DESCRIPTION}`,
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Workout title" },
        blocks: {
          type: "array",
          description:
            "Array of exercise blocks. Each block = { exercises: [{ movementId, sets?, reps?, duration?, spotter?, eccentric?, warmUp? }] }",
        },
      },
      required: ["title", "blocks"],
    },
  },
  {
    name: "estimate_workout",
    description: `Estimate duration of a workout before creating it. Same block format as create_custom_workout.
${EXERCISE_SCHEMA_DESCRIPTION}`,
    inputSchema: {
      type: "object",
      properties: {
        blocks: {
          type: "array",
          description: "Array of exercise blocks to estimate",
        },
      },
      required: ["blocks"],
    },
  },
  {
    name: "list_custom_workouts",
    description: "List user's custom/saved workouts",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "delete_custom_workout",
    description: "Delete a custom workout by ID",
    inputSchema: {
      type: "object",
      properties: {
        workoutId: { type: "string", description: "Custom workout UUID to delete" },
      },
      required: ["workoutId"],
    },
  },
];

export const workoutToolHandlers: Record<string, ToolHandler> = {
  create_custom_workout: (tc, args) => createCustomWorkout(tc, args),
  estimate_workout: (tc, args) => estimateWorkout(tc, args),
  list_custom_workouts: (tc) => listCustomWorkouts(tc),
  delete_custom_workout: (tc, args) => deleteCustomWorkout(tc, args),
};
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add convex/mcp/tools/workouts.ts
git commit -m "feat: add MCP workout tools (create, estimate, list, delete)"
```

---

### Task 12: Analytics tools (6 tools)

**Files:**

- Create: `convex/mcp/tools/analytics.ts`
- Test: `convex/mcp/tools/analytics.test.ts`

> **Note:** The spec calls for 3 new `internalAction`s in `proxy.ts`, but these are better implemented as pure aggregation functions in `analytics.ts` that compose with existing actions. No changes to `proxy.ts` needed.

- [ ] **Step 1: Write failing test for progress metrics aggregation**

Create `convex/mcp/tools/analytics.test.ts`:

```typescript
import { describe, it, expect, vi, afterEach } from "vitest";
import { aggregateProgressMetrics, aggregateTrainingFrequency } from "./analytics";

// Fixed timestamp for deterministic tests (2026-03-13T12:00:00Z)
const NOW = new Date("2026-03-13T12:00:00Z").getTime();

const mockActivities = [
  {
    activityId: "a1",
    activityTime: "2026-03-13T10:00:00Z",
    workoutPreview: {
      totalVolume: 5000,
      totalDuration: 1800,
      targetArea: "Upper Body",
    },
  },
  {
    activityId: "a2",
    activityTime: "2026-03-12T10:00:00Z",
    workoutPreview: {
      totalVolume: 3000,
      totalDuration: 1200,
      targetArea: "Lower Body",
    },
  },
  {
    activityId: "a3",
    activityTime: "2026-03-11T10:00:00Z",
    workoutPreview: {
      totalVolume: 4000,
      totalDuration: 1500,
      targetArea: "Upper Body",
    },
  },
];

describe("aggregateProgressMetrics", () => {
  it("computes totals and averages", () => {
    const result = aggregateProgressMetrics(mockActivities as never[]);
    expect(result.totalWorkouts).toBe(3);
    expect(result.totalVolumeLbs).toBe(12000);
    expect(result.avgVolumeLbs).toBe(4000);
    expect(result.workoutsByTargetArea["Upper Body"]).toBe(2);
    expect(result.workoutsByTargetArea["Lower Body"]).toBe(1);
  });

  it("handles empty array", () => {
    const result = aggregateProgressMetrics([]);
    expect(result.totalWorkouts).toBe(0);
    expect(result.avgVolumeLbs).toBe(0);
  });
});

describe("aggregateTrainingFrequency", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("groups by target area with session counts", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    const result = aggregateTrainingFrequency(mockActivities as never[], 30);
    expect(result.totalSessions).toBe(3);
    expect(result.byTargetArea.length).toBe(2);
    const upper = result.byTargetArea.find(
      (a: { targetArea: string }) => a.targetArea === "Upper Body",
    );
    expect(upper?.sessions).toBe(2);
    expect(upper?.totalVolumeLbs).toBe(9000);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run convex/mcp/tools/analytics.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement analytics tools with exported pure aggregation functions**

Create `convex/mcp/tools/analytics.ts`. The pure aggregation functions are exported for testing. The tool handlers call Convex actions then aggregate:

```typescript
import type { ToolDefinition, ToolHandler, ToolContext } from "../registry";
import { internal } from "../../_generated/api";
import type { Activity } from "../../tonal/types";

// --- Pure aggregation functions (exported for testing) ---

export function aggregateProgressMetrics(activities: Activity[]) {
  const totalWorkouts = activities.length;
  const totalVolume = activities.reduce((sum, a) => sum + (a.workoutPreview?.totalVolume ?? 0), 0);
  const totalDuration = activities.reduce(
    (sum, a) => sum + (a.workoutPreview?.totalDuration ?? 0),
    0,
  );

  const byTargetArea: Record<string, number> = {};
  for (const a of activities) {
    const area = a.workoutPreview?.targetArea ?? "Unknown";
    byTargetArea[area] = (byTargetArea[area] ?? 0) + 1;
  }

  return {
    totalWorkouts,
    totalVolumeLbs: totalVolume,
    totalDurationSeconds: totalDuration,
    avgVolumeLbs: totalWorkouts > 0 ? Math.round(totalVolume / totalWorkouts) : 0,
    avgDurationMinutes: totalWorkouts > 0 ? Math.round(totalDuration / totalWorkouts / 60) : 0,
    workoutsByTargetArea: byTargetArea,
  };
}

export function aggregateTrainingFrequency(activities: Activity[], days: number) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const inRange = activities.filter((a) => new Date(a.activityTime) >= cutoff);

  const byArea: Record<string, { count: number; lastDate: string; totalVolume: number }> = {};
  for (const a of inRange) {
    const area = a.workoutPreview?.targetArea ?? "Unknown";
    const existing = byArea[area];
    if (existing) {
      existing.count += 1;
      existing.totalVolume += a.workoutPreview?.totalVolume ?? 0;
      if (a.activityTime > existing.lastDate) existing.lastDate = a.activityTime;
    } else {
      byArea[area] = {
        count: 1,
        lastDate: a.activityTime,
        totalVolume: a.workoutPreview?.totalVolume ?? 0,
      };
    }
  }

  const now = new Date();
  const frequency = Object.entries(byArea)
    .map(([area, data]) => ({
      targetArea: area,
      sessions: data.count,
      totalVolumeLbs: data.totalVolume,
      lastWorkout: data.lastDate,
      daysSinceLastWorkout: Math.round(
        (now.getTime() - new Date(data.lastDate).getTime()) / 86400000,
      ),
    }))
    .sort((a, b) => b.sessions - a.sessions);

  return {
    periodDays: days,
    totalSessions: inRange.length,
    sessionsPerWeek: inRange.length > 0 ? Math.round((inRange.length / days) * 7 * 10) / 10 : 0,
    byTargetArea: frequency,
  };
}

// --- Tool handlers ---

async function listWorkoutHistory(
  toolCtx: ToolContext,
  args: Record<string, unknown>,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const limit = (args.limit as number) ?? 10;
  const activities: Activity[] = await toolCtx.ctx.runAction(
    internal.tonal.proxy.fetchWorkoutHistory,
    { userId: toolCtx.userId, limit },
  );
  const summaries = activities.map((a) => ({
    activityId: a.activityId,
    date: a.activityTime,
    title: a.workoutPreview?.workoutTitle,
    type: a.workoutPreview?.workoutType,
    targetArea: a.workoutPreview?.targetArea,
    duration: a.workoutPreview?.totalDuration,
    volume: a.workoutPreview?.totalVolume,
  }));
  return { content: [{ type: "text", text: JSON.stringify(summaries, null, 2) }] };
}

async function getWorkoutDetail(
  toolCtx: ToolContext,
  args: Record<string, unknown>,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const activityId = args.activityId as string;
  const detail = await toolCtx.ctx.runAction(internal.tonal.proxy.fetchWorkoutDetail, {
    userId: toolCtx.userId,
    activityId,
  });
  return { content: [{ type: "text", text: JSON.stringify(detail, null, 2) }] };
}

async function getWorkoutMovements(
  toolCtx: ToolContext,
  args: Record<string, unknown>,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const activityId = args.activityId as string;

  const [detail, formatted, movements] = await Promise.all([
    toolCtx.ctx.runAction(internal.tonal.proxy.fetchWorkoutDetail, {
      userId: toolCtx.userId,
      activityId,
    }),
    toolCtx.ctx
      .runAction(internal.tonal.proxy.fetchFormattedSummary, {
        userId: toolCtx.userId,
        summaryId: activityId,
      })
      .catch(() => null),
    toolCtx.ctx.runAction(internal.tonal.proxy.fetchMovements, {
      userId: toolCtx.userId,
    }),
  ]);

  const names = new Map(movements.map((m: { id: string; name: string }) => [m.id, m.name]));
  const movementVolume = new Map<string, number>();
  if (formatted?.movementSets) {
    for (const ms of formatted.movementSets) {
      movementVolume.set(ms.movementId, ms.totalVolume);
    }
  }

  const byMovement = new Map<
    string,
    { sets: typeof detail.workoutSetActivity; movementId: string }
  >();
  for (const set of detail.workoutSetActivity ?? []) {
    const existing = byMovement.get(set.movementId);
    if (existing) {
      existing.sets.push(set);
    } else {
      byMovement.set(set.movementId, { movementId: set.movementId, sets: [set] });
    }
  }

  const movementResults = Array.from(byMovement.values()).map((m) => {
    const totalReps = m.sets.reduce(
      (sum: number, s: { prescribedReps?: number }) => sum + (s.prescribedReps ?? 0),
      0,
    );
    const volume = movementVolume.get(m.movementId) ?? 0;
    return {
      exerciseName: names.get(m.movementId) ?? m.movementId,
      movementId: m.movementId,
      totalSets: m.sets.length,
      totalReps,
      volumeLbs: volume,
      avgWeightPerRep: totalReps > 0 && volume > 0 ? Math.round(volume / totalReps) : null,
      usedSpotter: m.sets.some((s: { spotter: boolean }) => s.spotter),
      usedEccentric: m.sets.some((s: { eccentric: boolean }) => s.eccentric),
    };
  });

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          { activityId, totalMovements: movementResults.length, movements: movementResults },
          null,
          2,
        ),
      },
    ],
  };
}

async function getProgressMetrics(
  toolCtx: ToolContext,
  args: Record<string, unknown>,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const limit = (args.limit as number) ?? 20;
  const activities: Activity[] = await toolCtx.ctx.runAction(
    internal.tonal.proxy.fetchWorkoutHistory,
    { userId: toolCtx.userId, limit },
  );
  const result = aggregateProgressMetrics(activities);
  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
}

async function getStrengthScoreHistory(
  toolCtx: ToolContext,
  args: Record<string, unknown>,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const limit = (args.limit as number) ?? 50;
  // fetchStrengthHistory doesn't accept limit — apply in-memory
  const history = await toolCtx.ctx.runAction(internal.tonal.proxy.fetchStrengthHistory, {
    userId: toolCtx.userId,
  });
  const mapped = history
    .slice(0, limit)
    .map(
      (h: {
        activityTime: string;
        overall: number;
        upper: number;
        lower: number;
        core: number;
      }) => ({
        date: h.activityTime,
        overall: h.overall,
        upper: h.upper,
        lower: h.lower,
        core: h.core,
      }),
    );
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({ dataPoints: mapped.length, history: mapped }, null, 2),
      },
    ],
  };
}

async function getTrainingFrequency(
  toolCtx: ToolContext,
  args: Record<string, unknown>,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const days = (args.days as number) ?? 30;
  const activities: Activity[] = await toolCtx.ctx.runAction(
    internal.tonal.proxy.fetchWorkoutHistory,
    { userId: toolCtx.userId, limit: 100 },
  );
  const result = aggregateTrainingFrequency(activities, days);
  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
}

export const analyticsToolDefinitions: ToolDefinition[] = [
  {
    name: "list_workout_history",
    description: "List recent workout activities with summaries",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Number of workouts (default 10, max 50)",
          default: 10,
          minimum: 1,
          maximum: 50,
        },
      },
    },
  },
  {
    name: "get_workout_detail",
    description: "Get full detail for a specific workout — sets, reps, volume breakdown",
    inputSchema: {
      type: "object",
      properties: {
        activityId: { type: "string", description: "Workout activity UUID" },
      },
      required: ["activityId"],
    },
  },
  {
    name: "get_workout_movements",
    description:
      "Get per-movement performance data — groups sets by exercise with volume, avg weight",
    inputSchema: {
      type: "object",
      properties: {
        activityId: { type: "string", description: "Workout activity UUID" },
      },
      required: ["activityId"],
    },
  },
  {
    name: "get_progress_metrics",
    description: "Get aggregated workout metrics — volume, frequency, total workouts over time",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Number of recent activities to analyze (default 20)",
          default: 20,
          minimum: 1,
          maximum: 100,
        },
      },
    },
  },
  {
    name: "get_strength_score_history",
    description: "Get strength score trend over time — upper, lower, core, and overall",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Number of data points (default 50)",
          default: 50,
          minimum: 1,
          maximum: 500,
        },
      },
    },
  },
  {
    name: "get_training_frequency",
    description: "Get workout frequency by target area — sessions, volume, days since last workout",
    inputSchema: {
      type: "object",
      properties: {
        days: {
          type: "number",
          description: "Number of days to analyze (default 30)",
          default: 30,
          minimum: 7,
          maximum: 365,
        },
      },
    },
  },
];

export const analyticsToolHandlers: Record<string, ToolHandler> = {
  list_workout_history: (tc, args) => listWorkoutHistory(tc, args),
  get_workout_detail: (tc, args) => getWorkoutDetail(tc, args),
  get_workout_movements: (tc, args) => getWorkoutMovements(tc, args),
  get_progress_metrics: (tc, args) => getProgressMetrics(tc, args),
  get_strength_score_history: (tc, args) => getStrengthScoreHistory(tc, args),
  get_training_frequency: (tc, args) => getTrainingFrequency(tc, args),
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run convex/mcp/tools/analytics.test.ts`
Expected: PASS

- [ ] **Step 5: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add convex/mcp/tools/analytics.ts convex/mcp/tools/analytics.test.ts
git commit -m "feat: add MCP analytics tools (6 tools including new aggregation)"
```

---

## Chunk 4: Resources, Prompts, Wire Everything Up

### Task 13: Resources

**Files:**

- Create: `convex/mcp/resources.ts`

- [ ] **Step 1: Implement 3 MCP resources**

Create `convex/mcp/resources.ts`:

```typescript
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
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add convex/mcp/resources.ts
git commit -m "feat: add MCP resources (exercises, profile, readiness)"
```

---

### Task 14: Prompts

**Files:**

- Create: `convex/mcp/prompts.ts`

- [ ] **Step 1: Implement 3 MCP prompts**

Create `convex/mcp/prompts.ts`. These are pure text templates ported from tonal-mcp `server.ts`:

```typescript
import type { PromptDefinition, PromptHandler } from "./registry";

async function buildWorkoutPrompt(params: Record<string, string>): ReturnType<PromptHandler> {
  const { muscleGroups, durationMinutes, difficulty } = params;
  return {
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Build me a ${durationMinutes}-minute Tonal workout targeting: ${muscleGroups}. Difficulty: ${difficulty}.

Instructions:
1. Use search_movements to find exercises for each target muscle group
2. Select 4-8 exercises that create a balanced workout
3. Group them into blocks — each block has 1-2 exercises (2 = superset)
4. Use estimate_workout with the blocks to check duration
5. Adjust sets/reps/blocks if the estimate doesn't match the target
6. Use create_custom_workout with the final blocks to create it

Block structure tips:
- Each block = 1-2 exercises. Single exercise = straight sets. Two = superset.
- Start with compound movements in early blocks, isolation in later blocks
- 2-4 sets per exercise, 8-12 reps for hypertrophy, 4-6 for strength
- Enable spotter on heavy compound lifts (bench press, squats)
- Beginners: 3-4 blocks, 3 sets each, no supersets
- Advanced: 4-6 blocks, supersets, consider eccentric mode on key lifts`,
        },
      },
    ],
  };
}

async function weeklyPlanPrompt(params: Record<string, string>): ReturnType<PromptHandler> {
  const { daysPerWeek, goals } = params;
  const goalGuidance =
    goals === "strength"
      ? "Focus on compound lifts, 3-5 rep range, longer rest"
      : goals === "endurance"
        ? "Higher rep ranges (12-20), shorter rest, circuit-style blocks"
        : "Mix heavy compound days with higher-rep accessory days";

  return {
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Design a ${daysPerWeek}-day weekly Tonal training plan. Goal: ${goals}.

Instructions:
1. Use get_muscle_readiness to check current recovery status
2. Use list_workout_history to review recent training (last 7-14 days)
3. Use get_strength_scores to understand current strength levels
4. Design the weekly split (e.g. Push/Pull/Legs, Upper/Lower, Full Body)
5. For each day, use search_movements to pick exercises
6. Create each day's workout with create_custom_workout

Guidelines:
- Prioritize recovered muscle groups first in the week
- Don't train the same muscle group on consecutive days
- ${goalGuidance}
- Include at least one rest day between intense sessions`,
        },
      },
    ],
  };
}

async function analyzeProgressPrompt(params: Record<string, string>): ReturnType<PromptHandler> {
  const { timeframe } = params;
  const limit = timeframe === "week" ? 7 : timeframe === "month" ? 30 : 90;
  return {
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Analyze my Tonal training progress for the past ${timeframe}.

Instructions:
1. Use get_progress_metrics with limit=${limit} to get workout history overview
2. Use list_workout_history with limit=${limit} for detailed session info
3. Use get_strength_scores to see current strength levels
4. Use get_muscle_readiness to check recovery status

Analyze:
- Training frequency and consistency
- Volume trends (are they progressing?)
- Target area balance (are any muscle groups neglected?)
- Workout type variety
- Duration patterns

Provide:
- A summary of training patterns
- Strengths and areas for improvement
- Specific recommendations for the next ${timeframe}
- Any muscle imbalances or overtraining concerns`,
        },
      },
    ],
  };
}

export const mcpPromptDefinitions: PromptDefinition[] = [
  {
    name: "build_workout",
    description: "Build a custom Tonal workout targeting specific muscle groups",
    arguments: [
      {
        name: "muscleGroups",
        description: "Comma-separated muscle groups (e.g. Chest,Shoulders,Triceps)",
        required: true,
      },
      { name: "durationMinutes", description: "Target duration in minutes", required: true },
      { name: "difficulty", description: "beginner, intermediate, or advanced", required: true },
    ],
  },
  {
    name: "weekly_plan",
    description: "Design a weekly Tonal training plan based on goals and recovery",
    arguments: [
      { name: "daysPerWeek", description: "Training days per week (3-6)", required: true },
      { name: "goals", description: "strength, endurance, or hybrid", required: true },
    ],
  },
  {
    name: "analyze_progress",
    description: "Analyze training progress and suggest improvements",
    arguments: [{ name: "timeframe", description: "week, month, or quarter", required: true }],
  },
];

export const mcpPromptHandlers: Record<string, PromptHandler> = {
  build_workout: buildWorkoutPrompt,
  weekly_plan: weeklyPlanPrompt,
  analyze_progress: analyzeProgressPrompt,
};
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add convex/mcp/prompts.ts
git commit -m "feat: add MCP prompts (build_workout, weekly_plan, analyze_progress)"
```

---

### Task 15: Wire registrations together

**Files:**

- Modify: `convex/mcp/registrations.ts`

- [ ] **Step 1: Update registrations to import all tools, resources, prompts**

Replace `convex/mcp/registrations.ts`:

```typescript
import type {
  ToolDefinition,
  ToolHandler,
  ResourceDefinition,
  ResourceHandler,
  PromptDefinition,
  PromptHandler,
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
```

- [ ] **Step 2: Update server test to assert 16 tools**

Update `convex/mcp/server.test.ts` — replace the `buildToolsListResult` test:

```typescript
describe("buildToolsListResult", () => {
  it("returns all 16 tool definitions", () => {
    const result = buildToolsListResult();
    expect(result.tools.length).toBe(16);
    const names = result.tools.map((t: { name: string }) => t.name);
    expect(names).toContain("get_user_profile");
    expect(names).toContain("search_movements");
    expect(names).toContain("create_custom_workout");
    expect(names).toContain("get_training_frequency");
  });
});
```

- [ ] **Step 3: Run all tests**

Run: `npx vitest run convex/mcp/`
Expected: ALL PASS (16 tools now registered)

- [ ] **Step 4: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add convex/mcp/registrations.ts convex/mcp/server.test.ts
git commit -m "feat: wire all MCP tools, resources, and prompts into registrations"
```

---

## Chunk 5: Settings UI + Reference Material

### Task 16: Settings UI — Claude Integration section

**Files:**

- Create: `src/components/settings/McpKeyManager.tsx`
- Modify: `src/app/(app)/settings/page.tsx`

- [ ] **Step 1: Create McpKeyManager component**

Create `src/components/settings/McpKeyManager.tsx`:

```typescript
"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Check, Copy, Key, Loader2, Plus, Trash2 } from "lucide-react";

export function McpKeyManager() {
  const keys = useQuery(api.mcp.keys.listMcpApiKeys);
  const generateKey = useMutation(api.mcp.keys.generateMcpApiKey);
  const revokeKey = useMutation(api.mcp.keys.revokeMcpApiKey);

  const [newKeyLabel, setNewKeyLabel] = useState("");
  const [justCreatedKey, setJustCreatedKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL ?? "";
  const mcpUrl = convexUrl.replace(".cloud", ".site") + "/mcp";

  const handleCreate = async () => {
    setCreating(true);
    try {
      const result = await generateKey({
        label: newKeyLabel.trim() || undefined,
      });
      setJustCreatedKey(result.key);
      setNewKeyLabel("");
      setShowForm(false);
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (keyId: Id<"mcpApiKeys">) => {
    if (!confirm("Revoke this API key? Any clients using it will stop working.")) return;
    await revokeKey({ keyId });
  };

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard API can fail if page is not focused
    }
  };

  // Loading state
  if (keys === undefined) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const configSnippet = justCreatedKey
    ? JSON.stringify(
        {
          mcpServers: {
            "tonal-coach": {
              url: mcpUrl,
              headers: { Authorization: `Bearer ${justCreatedKey}` },
            },
          },
        },
        null,
        2,
      )
    : "";

  // Just created a key — show it once
  if (justCreatedKey) {
    return (
      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="rounded-md bg-amber-500/10 p-3">
            <p className="text-sm font-medium text-amber-600">
              Copy this key now — it won't be shown again
            </p>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-muted p-2 text-xs break-all">
              {justCreatedKey}
            </code>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleCopy(justCreatedKey, "key")}
            >
              {copied === "key" ? <Check className="size-4" /> : <Copy className="size-4" />}
            </Button>
          </div>
          <div>
            <p className="mb-2 text-xs text-muted-foreground">
              Claude Desktop / Claude Code config:
            </p>
            <div className="relative">
              <pre className="rounded bg-muted p-3 text-xs overflow-x-auto">
                {configSnippet}
              </pre>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-2"
                onClick={() => handleCopy(configSnippet, "config")}
              >
                {copied === "config" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              </Button>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setJustCreatedKey(null)}
          >
            Done
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4">
        {keys.length > 0 ? (
          <div className="space-y-3">
            {keys.map((k) => (
              <div
                key={k._id}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <div className="flex items-center gap-3">
                  <Key className="size-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">
                      {k.label ?? "API Key"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Created {new Date(k.createdAt).toLocaleDateString()}
                      {k.lastUsedAt && (
                        <> · Last used {new Date(k.lastUsedAt).toLocaleDateString()}</>
                      )}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRevoke(k._id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Connect Claude Desktop or Claude Code to your Tonal data. Generate
            an API key and add it to your Claude config.
          </p>
        )}

        {showForm ? (
          <div className="mt-4 flex items-center gap-2">
            <Input
              placeholder="Label (e.g. Claude Desktop - MacBook)"
              value={newKeyLabel}
              onChange={(e) => setNewKeyLabel(e.target.value)}
              className="text-sm"
            />
            <Button size="sm" onClick={handleCreate} disabled={creating}>
              {creating ? "Creating..." : "Create"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => setShowForm(true)}
          >
            <Plus className="mr-1.5 size-3.5" />
            Create API Key
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Add McpKeyManager to settings page**

Modify `src/app/(app)/settings/page.tsx`. Add after the Tonal Connection section (after the `<Separator className="mb-6" />` on line 102):

```typescript
import { McpKeyManager } from "@/components/settings/McpKeyManager";
```

And add the section JSX before the About section:

```tsx
{/* Claude Integration Section */}
<section className="mb-6">
  <h2 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wider">
    Claude Integration
  </h2>
  <McpKeyManager />
</section>

<Separator className="mb-6" />
```

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/settings/McpKeyManager.tsx src/app/\(app\)/settings/page.tsx
git commit -m "feat: add Claude Integration settings UI for MCP API key management"
```

---

### Task 17: Copy tonal-mcp as reference material

**Files:**

- Create: `docs/reference/tonal-mcp-original/` (directory copy)

- [ ] **Step 1: Copy tonal-mcp source to reference directory**

```bash
mkdir -p docs/reference/tonal-mcp-original
cp -r /Users/jeffreyotano/GitHub/tonal-mcp/src docs/reference/tonal-mcp-original/
cp /Users/jeffreyotano/GitHub/tonal-mcp/package.json docs/reference/tonal-mcp-original/
cp /Users/jeffreyotano/GitHub/tonal-mcp/tsconfig.json docs/reference/tonal-mcp-original/
cp /Users/jeffreyotano/GitHub/tonal-mcp/README.md docs/reference/tonal-mcp-original/
```

- [ ] **Step 2: Commit**

```bash
git add docs/reference/tonal-mcp-original/
git commit -m "chore: archive tonal-mcp source as reference material"
```

---

### Task 18: Final verification

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: ALL PASS

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Verify tool count**

Run: `npx vitest run convex/mcp/server.test.ts`
Expected: PASS — confirms 16 tools registered

- [ ] **Step 4: Commit any final fixes if needed**

---

## Task Dependency Summary

```
Task 1 (schema) -> Task 2 (keys) -> Task 3 (auth) -> Task 4 (usage)
                                                           |
Task 5 (rate limits) ----+                                 |
Task 6 (protocol) -------+-> Task 8 (server + HTTP) ------+
Task 7 (registry types) -+                                 |
                                                           v
Task 9 (user tools) --------+                    Task 15 (wire up)
Task 10 (exercise tools) ---+                         |
Task 11 (workout tools) ----+-> Task 15 (wire up) -> Task 18 (verify)
Task 12 (analytics tools) --+                         |
Task 13 (resources) --------+                    Task 16 (settings UI)
Task 14 (prompts) ----------+                    Task 17 (reference copy)
```
