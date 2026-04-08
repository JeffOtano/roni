import { describe, expect, it } from "vitest";
import { INVALID_REQUEST, jsonRpcError, jsonRpcSuccess, parseJsonRpcRequest } from "./protocol";

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
