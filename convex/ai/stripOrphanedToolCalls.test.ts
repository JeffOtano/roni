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

  it("removes orphaned tool-result whose tool-call was already stripped", () => {
    // A partially-persisted retry left a tool role message with a tool-result
    // that has no preceding assistant tool-call in the history.
    const msgs: ModelMessage[] = [
      { role: "user", content: "check scores" },
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: "tc-orphan",
            toolName: "get_scores",
            output: { type: "text", value: "leftover" },
          },
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

  it("keeps tool messages whose tool-result references a paired assistant tool-call", () => {
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

  it("preserves tool-approval-response parts even when no toolCallId reference matches", () => {
    // tool-approval-response is keyed by approvalId, not toolCallId,
    // so it must survive even if no paired assistant tool-call is present.
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

    const result = stripOrphanedToolCalls(msgs);

    // The tool-approval-response message must survive intact
    const toolMsg = result.find((m) => m.role === "tool");
    expect(toolMsg).toBeDefined();
    const parts = toolMsg!.content as Array<{ type: string; approvalId: string }>;
    expect(parts).toHaveLength(1);
    expect(parts[0].type).toBe("tool-approval-response");
    expect(parts[0].approvalId).toBe("ap1");
  });

  it("strips only orphaned tool-result parts when message has mixed parts", () => {
    // One tool-result references a kept assistant tool-call (tc-kept);
    // another references a tool-call that was never emitted (tc-orphan).
    // The orphaned part must be removed; the kept part must stay.
    const msgs: ModelMessage[] = [
      { role: "user", content: "hello" },
      {
        role: "assistant",
        content: [{ type: "tool-call", toolCallId: "tc-kept", toolName: "get_scores", input: {} }],
      },
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: "tc-kept",
            toolName: "get_scores",
            output: { type: "text", value: "ok" },
          },
          {
            type: "tool-result",
            toolCallId: "tc-orphan",
            toolName: "search",
            output: { type: "text", value: "stale" },
          },
        ],
      },
      { role: "assistant", content: "Here you go." },
    ];

    const result = stripOrphanedToolCalls(msgs);

    const toolMsg = result.find((m) => m.role === "tool");
    expect(toolMsg).toBeDefined();
    const parts = toolMsg!.content as Array<{ type: string; toolCallId?: string }>;
    expect(parts).toHaveLength(1);
    expect(parts[0].toolCallId).toBe("tc-kept");
  });
});
