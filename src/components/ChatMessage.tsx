"use client";

import { cn } from "@/lib/utils";
import { ToolCallIndicator } from "@/components/ToolCallIndicator";
import type { UIMessage } from "@convex-dev/agent/react";

interface ChatMessageProps {
  message: UIMessage;
}

function formatTimestamp(ms: number): string {
  const date = new Date(ms);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/**
 * Renders text with basic markdown-like formatting:
 * newlines to <br/>, **bold**, and `code`.
 */
function FormattedText({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  // Split by **bold** and `code` patterns
  const regex = /(\*\*(.+?)\*\*|`([^`]+)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(
        <TextWithBreaks key={`t-${lastIndex}`} text={text.slice(lastIndex, match.index)} />
      );
    }

    if (match[2]) {
      // Bold text
      parts.push(<strong key={`b-${match.index}`}>{match[2]}</strong>);
    } else if (match[3]) {
      // Inline code
      parts.push(
        <code
          key={`c-${match.index}`}
          className="rounded bg-muted px-1 py-0.5 text-[0.85em] font-mono"
        >
          {match[3]}
        </code>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(
      <TextWithBreaks key={`t-${lastIndex}`} text={text.slice(lastIndex)} />
    );
  }

  return <>{parts}</>;
}

function TextWithBreaks({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, i) => (
        <span key={i}>
          {line}
          {i < lines.length - 1 && <br />}
        </span>
      ))}
    </>
  );
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";
  const isStreaming = message.status === "streaming";

  return (
    <div
      className={cn(
        "flex w-full",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        )}
      >
        {message.parts.map((part, i) => {
          if (part.type === "text") {
            return (
              <span key={i}>
                <FormattedText text={part.text} />
                {isStreaming &&
                  i === message.parts.length - 1 &&
                  part.state === "streaming" && (
                    <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-current align-text-bottom" />
                  )}
              </span>
            );
          }

          if (part.type === "dynamic-tool") {
            return (
              <ToolCallIndicator
                key={part.toolCallId}
                toolName={part.toolName}
                state={part.state}
                input={part.input}
              />
            );
          }

          return null;
        })}

        <div
          className={cn(
            "mt-1 text-[10px] opacity-50",
            isUser ? "text-right" : "text-left"
          )}
        >
          {formatTimestamp(message._creationTime)}
        </div>
      </div>
    </div>
  );
}
