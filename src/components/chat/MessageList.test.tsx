import type { UIMessage } from "@convex-dev/agent/react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MessageList } from "./MessageList";

const chatMessageMock = vi.fn(
  ({ isGrouped, message }: { isGrouped?: boolean; message: UIMessage }) => (
    <div data-testid="chat-message">
      {message.key}:{isGrouped ? "grouped" : "solo"}
    </div>
  ),
);

vi.mock("./ChatMessage", () => ({
  ChatMessage: (props: { isGrouped?: boolean; message: UIMessage }) => chatMessageMock(props),
}));

vi.mock("@/components/DateDivider", () => ({
  DateDivider: ({ timestamp }: { timestamp: number }) => (
    <div data-testid="date-divider">{timestamp}</div>
  ),
}));

function createMessage(overrides: Partial<UIMessage>): UIMessage {
  return {
    id: "message-1",
    key: "message-1",
    _creationTime: Date.UTC(2026, 0, 1, 10, 0),
    order: 0,
    parts: [{ text: "Hello", type: "text" }],
    role: "user",
    status: "success",
    stepOrder: 0,
    text: "Hello",
    ...overrides,
  };
}

describe("MessageList", () => {
  it("groups consecutive messages on the same day", () => {
    const messages = [
      createMessage({ key: "one" }),
      createMessage({
        _creationTime: Date.UTC(2026, 0, 1, 10, 5),
        key: "two",
        text: "Second",
      }),
    ];

    render(<MessageList messages={messages} threadId="thread-1" />);

    expect(screen.getAllByTestId("chat-message")).toHaveLength(2);
    expect(screen.getAllByTestId("chat-message")[0]).toHaveTextContent("one:solo");
    expect(screen.getAllByTestId("chat-message")[1]).toHaveTextContent("two:grouped");
    expect(screen.getAllByTestId("date-divider")).toHaveLength(1);
  });

  it("adds a new date divider when the day changes", () => {
    const messages = [
      createMessage({ key: "one" }),
      createMessage({
        _creationTime: Date.UTC(2026, 0, 2, 8, 0),
        key: "two",
        text: "Next day",
      }),
    ];

    render(<MessageList messages={messages} threadId="thread-1" />);

    expect(screen.getAllByTestId("date-divider")).toHaveLength(2);
    expect(screen.getAllByTestId("chat-message")[1]).toHaveTextContent("two:solo");
  });

  it("hides assistant messages with no visible text or tool parts", () => {
    const messages = [
      createMessage({ key: "one", role: "assistant", text: "Visible assistant" }),
      createMessage({
        key: "two",
        parts: [],
        role: "assistant",
        text: "   ",
      }),
    ];

    render(<MessageList messages={messages} threadId="thread-1" />);

    expect(screen.getAllByTestId("chat-message")).toHaveLength(1);
    expect(screen.queryByText("two:solo")).not.toBeInTheDocument();
  });
});
