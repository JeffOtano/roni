import { describe, expect, it } from "vitest";
import type { ModelMessage } from "ai";
import { coachAgentConfig, mergeConsecutiveSameRole, stripOrphanedToolCalls } from "./coach";

type ContextHandlerArgs = Parameters<typeof coachAgentConfig.contextHandler>[1];

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

  return coachAgentConfig.contextHandler(undefined as never, args);
}

describe("mergeConsecutiveSameRole", () => {
  it("returns empty array unchanged", () => {
    expect(mergeConsecutiveSameRole([])).toEqual([]);
  });

  it("returns single message unchanged", () => {
    const msgs: ModelMessage[] = [{ role: "user", content: "hi" }];
    expect(mergeConsecutiveSameRole(msgs)).toEqual(msgs);
  });

  it("leaves alternating roles untouched", () => {
    const msgs: ModelMessage[] = [
      { role: "user", content: "hello" },
      { role: "assistant", content: "hi there" },
      { role: "user", content: "plan my week" },
    ];
    expect(mergeConsecutiveSameRole(msgs)).toEqual(msgs);
  });

  it("merges consecutive assistant messages (string + string)", () => {
    const msgs: ModelMessage[] = [
      { role: "user", content: "hello" },
      { role: "assistant", content: "search result text" },
      { role: "assistant", content: "recent context text" },
      { role: "user", content: "plan my week" },
    ];
    const result = mergeConsecutiveSameRole(msgs);
    expect(result).toHaveLength(3);
    expect(result[1].role).toBe("assistant");
    expect(result[1].content).toEqual([
      { type: "text", text: "search result text" },
      { type: "text", text: "recent context text" },
    ]);
  });

  it("merges consecutive assistant messages (text + tool-call)", () => {
    const msgs: ModelMessage[] = [
      { role: "user", content: "hello" },
      { role: "assistant", content: "I can help with that" },
      {
        role: "assistant",
        content: [{ type: "tool-call", toolCallId: "tc1", toolName: "get_scores", input: {} }],
      },
    ];
    const result = mergeConsecutiveSameRole(msgs);
    expect(result).toHaveLength(2);
    expect(result[1].role).toBe("assistant");
    expect(result[1].content).toEqual([
      { type: "text", text: "I can help with that" },
      { type: "tool-call", toolCallId: "tc1", toolName: "get_scores", input: {} },
    ]);
  });

  it("merges more than two consecutive messages", () => {
    const msgs: ModelMessage[] = [
      { role: "assistant", content: "a" },
      { role: "assistant", content: "b" },
      { role: "assistant", content: "c" },
    ];
    const result = mergeConsecutiveSameRole(msgs);
    expect(result).toHaveLength(1);
    expect(result[0].content).toEqual([
      { type: "text", text: "a" },
      { type: "text", text: "b" },
      { type: "text", text: "c" },
    ]);
  });

  it("does not merge consecutive system messages", () => {
    const msgs: ModelMessage[] = [
      { role: "system", content: "instructions" },
      { role: "system", content: "training data" },
      { role: "user", content: "hello" },
    ];
    const result = mergeConsecutiveSameRole(msgs);
    expect(result).toHaveLength(3);
  });

  it("merges consecutive user messages", () => {
    const msgs: ModelMessage[] = [
      { role: "assistant", content: "done" },
      { role: "user", content: "first" },
      { role: "user", content: "second" },
    ];
    const result = mergeConsecutiveSameRole(msgs);
    expect(result).toHaveLength(2);
    expect(result[1].content).toEqual([
      { type: "text", text: "first" },
      { type: "text", text: "second" },
    ]);
  });
});

describe("stripOrphanedToolCalls", () => {
  it("passes through messages with no tool calls", () => {
    const msgs: ModelMessage[] = [
      { role: "user", content: "hello" },
      { role: "assistant", content: "hi" },
    ];
    expect(stripOrphanedToolCalls(msgs)).toEqual(msgs);
  });

  it("keeps paired tool-call and tool-result", () => {
    const msgs: ModelMessage[] = [
      { role: "user", content: "check scores" },
      {
        role: "assistant",
        content: [{ type: "tool-call", toolCallId: "tc1", toolName: "get_scores", input: {} }],
      },
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: "tc1",
            toolName: "get_scores",
            output: { type: "text", value: "done" },
          },
        ],
      },
      { role: "assistant", content: "Your scores are great." },
    ];
    expect(stripOrphanedToolCalls(msgs)).toEqual(msgs);
  });

  it("keeps tool-calls that were resolved by an approval response", () => {
    const msgs: ModelMessage[] = [
      {
        role: "assistant",
        content: [
          { type: "text", text: "Approve this push?" },
          { type: "tool-call", toolCallId: "tc1", toolName: "approve_week_plan", input: {} },
          { type: "tool-approval-request", approvalId: "ap1", toolCallId: "tc1" },
        ],
      },
      {
        role: "tool",
        content: [{ type: "tool-approval-response", approvalId: "ap1", approved: true }],
      },
      { role: "user", content: "Looks good" },
    ];

    expect(stripOrphanedToolCalls(msgs)).toEqual(msgs);
  });

  it("keeps tool-calls that have a pending approval request", () => {
    const msgs: ModelMessage[] = [
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

    expect(stripOrphanedToolCalls(msgs)).toEqual(msgs);
  });

  it("removes orphaned tool-call with no matching tool-result", () => {
    const msgs: ModelMessage[] = [
      { role: "user", content: "check scores" },
      {
        role: "assistant",
        content: [
          { type: "tool-call", toolCallId: "tc-orphan", toolName: "get_scores", input: {} },
        ],
      },
      { role: "user", content: "try again" },
    ];
    const result = stripOrphanedToolCalls(msgs);
    // The assistant message with only the orphaned tool-call is removed entirely
    expect(result).toEqual([
      { role: "user", content: "check scores" },
      { role: "user", content: "try again" },
    ]);
  });

  it("keeps text parts when only some tool-calls are orphaned", () => {
    const msgs: ModelMessage[] = [
      { role: "user", content: "hello" },
      {
        role: "assistant",
        content: [
          { type: "text", text: "Let me check." },
          { type: "tool-call", toolCallId: "tc-good", toolName: "get_scores", input: {} },
          { type: "tool-call", toolCallId: "tc-orphan", toolName: "search", input: {} },
        ],
      },
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: "tc-good",
            toolName: "get_scores",
            output: { type: "text", value: "ok" },
          },
        ],
      },
    ];
    const result = stripOrphanedToolCalls(msgs);
    expect(result).toHaveLength(3);
    const assistantContent = result[1].content as Array<{ type: string; toolCallId?: string }>;
    expect(assistantContent).toHaveLength(2);
    expect(assistantContent[0]).toEqual({ type: "text", text: "Let me check." });
    expect(assistantContent[1].toolCallId).toBe("tc-good");
  });

  it("handles string content on assistant messages", () => {
    const msgs: ModelMessage[] = [{ role: "assistant", content: "just text" }];
    expect(stripOrphanedToolCalls(msgs)).toEqual(msgs);
  });
});

describe("coachAgentConfig.contextHandler", () => {
  it("preserves pending approval-requested tool calls", async () => {
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

    await expect(runContextHandler(messages)).resolves.toEqual(messages);
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
