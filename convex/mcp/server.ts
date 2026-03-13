import { httpAction } from "../_generated/server";
import {
  INTERNAL_ERROR,
  INVALID_PARAMS,
  INVALID_REQUEST,
  jsonRpcError,
  jsonRpcSuccess,
  METHOD_NOT_FOUND,
  PARSE_ERROR,
  parseJsonRpcRequest,
  RATE_LIMITED,
  UNAUTHORIZED,
} from "./protocol";
import { authenticateMcpRequest, McpAuthError } from "./auth";
import { internal } from "../_generated/api";
import { rateLimiter } from "../rateLimits";
import {
  promptDefinitions,
  promptHandlers,
  resourceDefinitions,
  resourceHandlers,
  toolDefinitions,
  toolHandlers,
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

  // Notifications — return 204 No Content per JSON-RPC spec
  if (rpc.method === "notifications/initialized") {
    return new Response(null, { status: 204 });
  }

  if (rpc.method === "ping") {
    return jsonResponse(jsonRpcSuccess(rpc.id, {}));
  }

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
      jsonRpcError(rpc.id, RATE_LIMITED, "Rate limit exceeded. Try again shortly."),
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
