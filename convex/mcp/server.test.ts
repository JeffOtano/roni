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
