import { describe, expect, it } from "vitest";
import type { ModelMessage } from "ai";
import { coachAgentConfig, makeCoachAgentConfig } from "./coach";

const claudeTestConfig = makeCoachAgentConfig(undefined, "claude");
type ContextHandlerArgs = Parameters<NonNullable<typeof claudeTestConfig.contextHandler>>[1];

const EMPTY_PROFILE_CTX = { runQuery: async () => null };

async function runClaudeContextHandler(
  allMessages: ModelMessage[],
  userId?: string,
): Promise<ModelMessage[]> {
  const args: ContextHandlerArgs = {
    allMessages,
    search: [],
    recent: [],
    inputMessages: [],
    inputPrompt: [],
    existingResponses: [],
    userId,
    threadId: undefined,
  };
  const ctx = (userId ? EMPTY_PROFILE_CTX : undefined) as never;
  return claudeTestConfig.contextHandler!(ctx, args);
}

function systemText(message: ModelMessage): string {
  expect(message.role).toBe("system");
  expect(typeof message.content).toBe("string");
  return message.content as string;
}

describe("coachAgentConfig.tools — Anthropic tool cache breakpoint", () => {
  it("marks exactly one tool with anthropic cacheControl — the last one in the registry", () => {
    const toolEntries = Object.entries(coachAgentConfig.tools);
    const tagged = toolEntries.filter(
      ([, t]) =>
        (t as { providerOptions?: { anthropic?: { cacheControl?: unknown } } }).providerOptions
          ?.anthropic?.cacheControl,
    );
    expect(tagged).toHaveLength(1);
    expect(tagged[0][0]).toBe(toolEntries[toolEntries.length - 1][0]);
  });
});

describe("coachAgentConfig.contextHandler — Claude prefix layout", () => {
  const userId = "user_claude_prefix";

  it("places the snapshot immediately before the final turn (not at system[1])", async () => {
    const messages: ModelMessage[] = [
      { role: "user", content: "q1" },
      { role: "assistant", content: "a1" },
      { role: "user", content: "q2" },
    ];

    const result = await runClaudeContextHandler(messages, userId);

    expect(result).toHaveLength(5);
    expect(systemText(result[0])).toContain("PERSONALITY:");
    expect(result[1]).toMatchObject({ role: "user", content: "q1" });
    expect(result[2]).toMatchObject({ role: "assistant", content: "a1" });
    expect(systemText(result[3])).toMatch(/^<training-data>\n[\s\S]+\n<\/training-data>$/);
    expect(result[4]).toEqual({ role: "user", content: "q2" });
  });

  it("marks the last assistant message in the head with anthropic cacheControl", async () => {
    const messages: ModelMessage[] = [
      { role: "user", content: "q1" },
      { role: "assistant", content: "a1" },
      { role: "user", content: "q2" },
      { role: "assistant", content: "a2" },
      { role: "user", content: "q3" },
    ];

    const result = await runClaudeContextHandler(messages, userId);

    const taggedAssistants = result.filter(
      (m) => m.role === "assistant" && m.providerOptions?.anthropic?.cacheControl,
    );
    expect(taggedAssistants).toHaveLength(1);
    expect(taggedAssistants[0].content).toBe("a2");
  });

  it("emits two cacheControl markers when history has an assistant (static prefix + last assistant)", async () => {
    const messages: ModelMessage[] = [
      { role: "user", content: "q1" },
      { role: "assistant", content: "a1" },
      { role: "user", content: "q2" },
    ];

    const result = await runClaudeContextHandler(messages, userId);

    const tagged = result.filter((m) => m.providerOptions?.anthropic?.cacheControl);
    expect(tagged).toHaveLength(2);
    expect(tagged[0].role).toBe("system");
    expect(tagged[1].role).toBe("assistant");
  });

  it("places the assistant cache marker before the snapshot system message", async () => {
    const messages: ModelMessage[] = [
      { role: "user", content: "q1" },
      { role: "assistant", content: "a1" },
      { role: "user", content: "q2" },
    ];

    const result = await runClaudeContextHandler(messages, userId);

    const assistantIdx = result.findIndex(
      (m) => m.role === "assistant" && m.providerOptions?.anthropic?.cacheControl,
    );
    const snapshotIdx = result.findIndex(
      (m) =>
        m.role === "system" &&
        typeof m.content === "string" &&
        m.content.startsWith("<training-data>"),
    );
    expect(assistantIdx).toBeGreaterThanOrEqual(0);
    expect(snapshotIdx).toBeGreaterThan(assistantIdx);
  });

  it("emits only the static-system marker when the Claude history has no assistant yet", async () => {
    const result = await runClaudeContextHandler([{ role: "user", content: "hi" }], userId);

    const tagged = result.filter((m) => m.providerOptions?.anthropic?.cacheControl);
    expect(tagged).toHaveLength(1);
    expect(tagged[0].role).toBe("system");
  });
});
