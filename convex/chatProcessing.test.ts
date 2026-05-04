import { describe, expect, it } from "vitest";
import { classifyPromptIntent, selectCoachRoute } from "./chatProcessing";

describe("classifyPromptIntent", () => {
  const chars = (length: number) => "x".repeat(length);

  it("routes short low-intent messages as trivial", () => {
    expect(classifyPromptIntent("hello")).toBe("trivial");
    expect(classifyPromptIntent("thanks!")).toBe("trivial");
  });

  it("uses a strict length boundary for trivial messages", () => {
    expect(classifyPromptIntent(chars(29))).toBe("trivial");
    expect(classifyPromptIntent(chars(30))).toBe("default");
  });

  it("keeps short programming and tool commands complex", () => {
    expect(classifyPromptIntent("push it")).toBe("complex");
    expect(classifyPromptIntent("swap bench press")).toBe("complex");
  });

  it("routes longer non-keyword messages as default", () => {
    expect(classifyPromptIntent("How should I think about my last workout?")).toBe("default");
  });
});

describe("selectCoachRoute", () => {
  const primaryAgent = { name: "primary" };
  const fallbackAgent = { name: "fallback" };

  it("uses the fallback model as the first attempt for trivial prompts", () => {
    const route = selectCoachRoute(
      {
        primary: primaryAgent,
        fallback: fallbackAgent,
        primaryModelName: "claude-sonnet-4-6",
        fallbackModelName: "claude-haiku-4-5",
      },
      "trivial",
    );

    expect(route.primary).toBe(fallbackAgent);
    expect(route.fallback).toBe(primaryAgent);
    expect(route.primaryModelName).toBe("claude-haiku-4-5");
  });

  it("keeps the primary model first for complex prompts", () => {
    const route = selectCoachRoute(
      {
        primary: primaryAgent,
        fallback: fallbackAgent,
        primaryModelName: "claude-sonnet-4-6",
        fallbackModelName: "claude-haiku-4-5",
      },
      "complex",
    );

    expect(route.primary).toBe(primaryAgent);
    expect(route.fallback).toBe(fallbackAgent);
    expect(route.primaryModelName).toBe("claude-sonnet-4-6");
  });

  it("keeps the primary model first for default prompts", () => {
    const route = selectCoachRoute(
      {
        primary: primaryAgent,
        fallback: fallbackAgent,
        primaryModelName: "claude-sonnet-4-6",
        fallbackModelName: "claude-haiku-4-5",
      },
      "default",
    );

    expect(route.primary).toBe(primaryAgent);
    expect(route.fallback).toBe(fallbackAgent);
    expect(route.primaryModelName).toBe("claude-sonnet-4-6");
  });

  it("keeps the primary model first when the provider has no fallback model", () => {
    const route = selectCoachRoute(
      {
        primary: primaryAgent,
        fallback: primaryAgent,
        primaryModelName: "openrouter/auto",
        fallbackModelName: null,
      },
      "trivial",
    );

    expect(route.primary).toBe(primaryAgent);
    expect(route.fallback).toBe(primaryAgent);
    expect(route.primaryModelName).toBe("openrouter/auto");
  });
});
