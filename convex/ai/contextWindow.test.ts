import { describe, expect, it } from "vitest";
import type { ModelMessage } from "ai";
import {
  buildContextWindow,
  mergeConsecutiveSameRole,
  stripImagesFromOlderMessages,
} from "./contextWindow";

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

describe("buildContextWindow", () => {
  it("returns empty array unchanged and passes through user-first messages", () => {
    expect(buildContextWindow([])).toEqual([]);
    const msgs: ModelMessage[] = [
      { role: "user", content: "hello" },
      { role: "assistant", content: "hi" },
    ];
    expect(buildContextWindow(msgs)).toEqual(msgs);
  });

  it("drops orphaned leading assistant/tool messages from truncation", () => {
    const msgs: ModelMessage[] = [
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
      { role: "user", content: "thanks" },
      { role: "assistant", content: "You're welcome" },
    ];
    expect(buildContextWindow(msgs)).toEqual([
      { role: "user", content: "thanks" },
      { role: "assistant", content: "You're welcome" },
    ]);
  });

  it("preserves complete tool-call chains within a turn", () => {
    const msgs: ModelMessage[] = [
      { role: "user", content: "program my week" },
      {
        role: "assistant",
        content: [{ type: "tool-call", toolCallId: "tc1", toolName: "get_history", input: {} }],
      },
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: "tc1",
            toolName: "get_history",
            output: { type: "text", value: "history data" },
          },
        ],
      },
      {
        role: "assistant",
        content: [{ type: "tool-call", toolCallId: "tc2", toolName: "program_week", input: {} }],
      },
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: "tc2",
            toolName: "program_week",
            output: { type: "text", value: "week created" },
          },
        ],
      },
      { role: "assistant", content: "Here's your week plan." },
    ];
    expect(buildContextWindow(msgs)).toEqual(msgs);
  });

  it("drops older turns when token budget is exceeded", () => {
    const longContent = "x".repeat(40_000); // ~10K tokens, exceeds budget alone
    const msgs: ModelMessage[] = [
      { role: "user", content: longContent },
      { role: "assistant", content: "old response" },
      { role: "user", content: "recent question" },
      { role: "assistant", content: "recent answer" },
    ];
    const result = buildContextWindow(msgs, 5_000);
    expect(result).toEqual([
      { role: "user", content: "recent question" },
      { role: "assistant", content: "recent answer" },
    ]);
  });

  it("always includes at least the last user turn even if over budget", () => {
    const msgs: ModelMessage[] = [
      { role: "user", content: "x".repeat(200_000) },
      { role: "assistant", content: "response" },
    ];
    const result = buildContextWindow(msgs, 100);
    expect(result).toEqual(msgs);
  });

  it("keeps multiple turns when budget allows", () => {
    const msgs: ModelMessage[] = [
      { role: "user", content: "first" },
      { role: "assistant", content: "reply1" },
      { role: "user", content: "second" },
      { role: "assistant", content: "reply2" },
      { role: "user", content: "third" },
      { role: "assistant", content: "reply3" },
    ];
    expect(buildContextWindow(msgs, 50_000)).toEqual(msgs);
  });

  it("returns empty array when no user messages exist", () => {
    const msgs: ModelMessage[] = [
      { role: "assistant", content: "orphaned" },
      { role: "assistant", content: "response" },
    ];
    expect(buildContextWindow(msgs)).toEqual([]);
  });
});

describe("stripImagesFromOlderMessages", () => {
  it("replaces older image-only user message with placeholder", () => {
    const latestImage = new URL("https://example.com/latest.jpg");
    const msgs: ModelMessage[] = [
      {
        role: "user",
        content: [{ type: "image", image: new URL("https://example.com/old.jpg") }],
      },
      { role: "assistant", content: "I see the image" },
      {
        role: "user",
        content: [
          { type: "text", text: "latest" },
          { type: "image", image: latestImage },
        ],
      },
    ];

    const result = stripImagesFromOlderMessages(msgs);
    expect(result[0].content).toBe("[image message]");
    expect(result[1]).toEqual({ role: "assistant", content: "I see the image" });
    expect(result[2].content).toEqual([
      { type: "text", text: "latest" },
      { type: "image", image: latestImage },
    ]);
  });

  it("strips image parts but keeps text parts from older user messages", () => {
    const msgs: ModelMessage[] = [
      {
        role: "user",
        content: [
          { type: "text", text: "check this" },
          { type: "image", image: new URL("https://example.com/old.jpg") },
        ],
      },
      {
        role: "user",
        content: [{ type: "text", text: "follow up" }],
      },
    ];

    const result = stripImagesFromOlderMessages(msgs);
    expect(result[0].content).toEqual([{ type: "text", text: "check this" }]);
    expect(result[1].content).toEqual([{ type: "text", text: "follow up" }]);
  });

  it("leaves non-user messages untouched", () => {
    const msgs: ModelMessage[] = [
      { role: "assistant", content: "hello" },
      { role: "user", content: "hi" },
    ];
    expect(stripImagesFromOlderMessages(msgs)).toEqual(msgs);
  });
});
