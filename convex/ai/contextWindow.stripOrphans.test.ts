import { describe, expect, it } from "vitest";
import type { ModelMessage } from "ai";
import { stripOrphanedToolCalls } from "./contextWindow";

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

  it("keeps tool-calls when an approval request is still pending (no fresh user follow-up)", () => {
    const msgs: ModelMessage[] = [
      { role: "user", content: "deploy the plan" },
      {
        role: "assistant",
        content: [
          { type: "text", text: "Approve this push?" },
          { type: "tool-call", toolCallId: "tc1", toolName: "approve_week_plan", input: {} },
          { type: "tool-approval-request", approvalId: "ap1", toolCallId: "tc1" },
        ],
      },
    ];

    expect(stripOrphanedToolCalls(msgs)).toEqual(msgs);
  });

  it("strips tool-call when a fresh user message abandons the pending approval", () => {
    // Reproduces Gemini's "function call turn comes immediately after a user
    // turn or after a function response turn" error: an unresolved tool-call
    // followed by a fresh user prompt has no matching tool-result, so Gemini
    // rejects the conversation. The fix strips the orphan.
    const msgs: ModelMessage[] = [
      { role: "user", content: "deploy the plan" },
      {
        role: "assistant",
        content: [
          { type: "text", text: "Approve this push?" },
          { type: "tool-call", toolCallId: "tc1", toolName: "approve_week_plan", input: {} },
          { type: "tool-approval-request", approvalId: "ap1", toolCallId: "tc1" },
        ],
      },
      { role: "user", content: "actually nevermind, what does this change?" },
    ];

    const result = stripOrphanedToolCalls(msgs);
    expect(result).toHaveLength(3);
    const assistantContent = result[1].content as Array<{ type: string; toolCallId?: string }>;
    expect(assistantContent.some((p) => p.type === "tool-call")).toBe(false);
    expect(assistantContent.some((p) => p.type === "text")).toBe(true);
    expect(assistantContent.some((p) => p.type === "tool-approval-request")).toBe(true);
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
