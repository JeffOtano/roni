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
