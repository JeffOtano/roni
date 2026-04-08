import type { UIMessage } from "@convex-dev/agent/react";
import { render, screen } from "@testing-library/react";
import type { ComponentPropsWithoutRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { ChatMessage } from "./ChatMessage";

vi.mock("@convex-dev/agent/react", async () => {
  const actual =
    await vi.importActual<typeof import("@convex-dev/agent/react")>("@convex-dev/agent/react");

  return {
    ...actual,
    useSmoothText: (text: string) => [`smooth:${text}`],
  };
});

vi.mock("next/image", () => ({
  default: ({
    alt,
    unoptimized: _unoptimized,
    ...props
  }: ComponentPropsWithoutRef<"img"> & { unoptimized?: boolean }) => (
    <img {...props} alt={alt ?? ""} />
  ),
}));

vi.mock("@/components/chat/MarkdownContent", () => ({
  MarkdownContent: ({ content }: { content: string }) => (
    <div data-testid="markdown">{content}</div>
  ),
}));

vi.mock("@/components/chat/ToolApprovalCard", () => ({
  ToolApprovalCard: ({ approvalId, toolName }: { approvalId: string; toolName: string }) => (
    <div data-testid="tool-approval-card">
      {toolName}:{approvalId}
    </div>
  ),
}));

vi.mock("@/components/chat/ToolCallIndicator", () => ({
  ToolCallIndicator: ({ toolName, state }: { toolName: string; state: string }) => (
    <div data-testid="tool-call-indicator">
      {toolName}:{state}
    </div>
  ),
}));

vi.mock("@/components/chat/WeekPlanCard", () => ({
  WeekPlanCard: ({ plan }: { plan: { summary: string } }) => (
    <div data-testid="week-plan-card">{plan.summary}</div>
  ),
}));

function createMessage(overrides: Partial<UIMessage>): UIMessage {
  return {
    id: "message-1",
    key: "message-1",
    _creationTime: Date.UTC(2026, 0, 1, 15, 30),
    order: 0,
    parts: [{ text: "Hello", type: "text" }],
    role: "user",
    status: "success",
    stepOrder: 0,
    text: "Hello",
    ...overrides,
  };
}

describe("ChatMessage", () => {
  it("renders user text and attached images", () => {
    const message = createMessage({
      parts: [
        { text: "Progress update", type: "text" },
        {
          filename: "progress.png",
          mediaType: "image/png",
          type: "file",
          url: "blob:progress",
        },
      ],
      text: "Progress update",
    });

    render(<ChatMessage message={message} threadId="thread-1" />);

    expect(screen.getByText("Progress update")).toBeInTheDocument();
    expect(screen.getByAltText("progress.png")).toBeInTheDocument();
  });

  it("renders a structured week plan and trailing coach text", () => {
    const weekPlanJson = JSON.stringify({
      weekStartDate: "2026-04-06",
      split: "ppl",
      days: [
        {
          dayName: "Mon",
          durationMinutes: 45,
          exercises: [{ name: "Bench Press", reps: 8, sets: 3 }],
          sessionType: "Push",
          targetMuscles: "Chest, Triceps",
        },
      ],
      summary: "PPL split - 1 training day",
    });

    const message = createMessage({
      parts: [
        {
          text: `Here is your week.\n\n\`\`\`week-plan\n${weekPlanJson}\n\`\`\`\n\nFocus on quality reps.`,
          type: "text",
        },
      ],
      role: "assistant",
      text: `Here is your week.\n\n\`\`\`week-plan\n${weekPlanJson}\n\`\`\`\n\nFocus on quality reps.`,
    });

    render(<ChatMessage message={message} threadId="thread-1" />);

    expect(screen.getByTestId("week-plan-card")).toHaveTextContent("PPL split - 1 training day");
    expect(screen.getByTestId("markdown")).toHaveTextContent("Focus on quality reps.");
  });

  it("renders approval cards and tool indicators for dynamic tool parts", () => {
    const message = createMessage({
      parts: [
        { text: "Waiting on approval", type: "text" },
        {
          approval: { id: "approval-1" },
          input: { weekStartDate: "2026-04-06" },
          state: "approval-requested",
          toolCallId: "tool-call-1",
          toolName: "approve_week_plan",
          type: "dynamic-tool",
        },
      ],
      role: "assistant",
      text: "Waiting on approval",
    });

    render(<ChatMessage message={message} threadId="thread-1" />);

    expect(screen.getByTestId("tool-approval-card")).toHaveTextContent(
      "approve_week_plan:approval-1",
    );
    expect(screen.getByTestId("tool-call-indicator")).toHaveTextContent(
      "approve_week_plan:approval-requested",
    );
  });

  it("renders streaming coach text and approval responses", () => {
    const streamingMessage = createMessage({
      parts: [{ text: "Almost done", type: "text" }],
      role: "assistant",
      status: "streaming",
      text: "Almost done",
    });

    const approvedMessage = createMessage({
      parts: [
        {
          approval: { approved: true, id: "approval-2" },
          input: {},
          state: "approval-responded",
          toolCallId: "tool-call-2",
          toolName: "approve_week_plan",
          type: "dynamic-tool",
        },
      ],
      role: "assistant",
      text: "",
    });

    const { rerender } = render(<ChatMessage message={streamingMessage} threadId="thread-1" />);

    expect(screen.getByTestId("markdown")).toHaveTextContent("smooth:Almost done");

    rerender(<ChatMessage message={approvedMessage} threadId="thread-1" />);

    expect(screen.getByText(/Approved/)).toBeInTheDocument();
  });
});
