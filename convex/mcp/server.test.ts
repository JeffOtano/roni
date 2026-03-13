import { describe, expect, it } from "vitest";
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
