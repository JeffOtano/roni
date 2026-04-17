import { describe, expect, it } from "vitest";
import type { ModelMessage } from "ai";
import { makeCoachAgentConfig } from "./coach";

const testConfig = makeCoachAgentConfig();
type ContextHandlerArgs = Parameters<NonNullable<typeof testConfig.contextHandler>>[1];

async function runContextHandler(allMessages: ModelMessage[]): Promise<ModelMessage[]> {
  const args: ContextHandlerArgs = {
    allMessages,
    search: [],
    recent: [],
    inputMessages: [],
    inputPrompt: [],
    existingResponses: [],
    userId: undefined,
    threadId: undefined,
  };

  return testConfig.contextHandler!(undefined as never, args);
}

function nonSystemMessages(messages: ModelMessage[]): ModelMessage[] {
  return messages.filter((m) => m.role !== "system");
}

describe("coachAgentConfig.contextHandler", () => {
  it("trims leading assistant messages so context starts with a user turn", async () => {
    const messages: ModelMessage[] = [
      {
        role: "assistant",
        content: [
          { type: "text", text: "Approve this push?" },
          { type: "tool-call", toolCallId: "tc1", toolName: "approve_week_plan", input: {} },
          { type: "tool-approval-request", approvalId: "ap1", toolCallId: "tc1" },
        ],
      },
      { role: "user", content: "What does this change?" },
    ];

    expect(nonSystemMessages(await runContextHandler(messages))).toEqual([
      { role: "user", content: "What does this change?" },
    ]);
  });

  it("normalizes orphaned tool calls before stripping old images and merging messages", async () => {
    const latestImage = new URL("https://example.com/latest.jpg");

    const result = await runContextHandler([
      {
        role: "user",
        content: [
          { type: "text", text: "older image note" },
          {
            type: "image",
            image: new URL("https://example.com/older.jpg"),
            mediaType: "image/jpeg",
          },
        ],
      },
      {
        role: "assistant",
        content: [
          { type: "tool-call", toolCallId: "tc-orphan", toolName: "search_exercises", input: {} },
        ],
      },
      { role: "user", content: "retry after failure" },
      {
        role: "user",
        content: [
          { type: "text", text: "latest image note" },
          { type: "image", image: latestImage, mediaType: "image/jpeg" },
        ],
      },
    ]);

    expect(nonSystemMessages(result)).toEqual([
      {
        role: "user",
        content: [
          { type: "text", text: "older image note" },
          { type: "text", text: "retry after failure" },
          { type: "text", text: "latest image note" },
          { type: "image", image: latestImage, mediaType: "image/jpeg" },
        ],
      },
    ]);
  });
});

describe("coachAgentConfig.contextHandler — Anthropic prompt caching", () => {
  it("emits the static instructions as the first system message with cacheControl", async () => {
    const result = await runContextHandler([{ role: "user", content: "hi" }]);

    const first = result[0];
    expect(first.role).toBe("system");
    expect(typeof first.content === "string" && first.content).toContain("PERSONALITY:");
    expect(first.providerOptions).toEqual({
      anthropic: { cacheControl: { type: "ephemeral" } },
    });
  });

  it("emits exactly one cacheControl marker", async () => {
    const result = await runContextHandler([{ role: "user", content: "hi" }]);

    const tagged = result.filter((m) => m.providerOptions?.anthropic?.cacheControl);
    expect(tagged).toHaveLength(1);
  });

  it("omits the snapshot system message when no userId is present", async () => {
    const result = await runContextHandler([{ role: "user", content: "hi" }]);

    const systemMessages = result.filter((m) => m.role === "system");
    expect(systemMessages).toHaveLength(1);
  });
});
