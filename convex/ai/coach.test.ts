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

    await expect(runContextHandler(messages)).resolves.toEqual([
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

    expect(result).toEqual([
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
