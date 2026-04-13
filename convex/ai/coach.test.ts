import { describe, expect, it } from "vitest";
import type { ModelMessage } from "ai";
import { mergeConsecutiveSameRole } from "./coach";

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
