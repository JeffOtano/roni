"use client";

import type { UIMessage } from "@convex-dev/agent/react";
import { MarkdownContent } from "@/components/MarkdownContent";
import { ToolCallIndicator } from "@/components/ToolCallIndicator";
import { Sparkles } from "lucide-react";

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

interface ChatMessageProps {
  message: UIMessage;
  userInitial?: string;
}

export function ChatMessage({ message, userInitial = "U" }: ChatMessageProps) {
  const isUser = message.role === "user";
  const isStreaming = message.status === "streaming";

  return (
    <div className="border-b border-border px-4 py-3 last:border-b-0 sm:px-6">
      {/* Header: avatar + role + timestamp */}
      <div className="mb-1.5 flex items-center gap-2">
        {isUser ? (
          <div className="flex size-6 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
            {userInitial}
          </div>
        ) : (
          <div className="flex size-6 items-center justify-center rounded-full bg-muted">
            <Sparkles className="size-3 text-muted-foreground" />
          </div>
        )}
        <span className="text-xs font-medium text-muted-foreground">
          {isUser ? "You" : "Coach"}
        </span>
        <span className="text-[11px] text-muted-foreground/50">
          {formatTime(message._creationTime)}
        </span>
      </div>

      {/* Content — indented to align with role name */}
      <div className="pl-8">
        {message.parts.map((part, i) => {
          if (part.type === "text") {
            const text = part.text;
            if (!text && !isStreaming) return null;

            if (isUser) {
              return (
                <p
                  key={i}
                  className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90"
                >
                  {text}
                </p>
              );
            }

            // Coach: render with markdown
            const displayText = isStreaming ? text + "\u258D" : text;
            return <MarkdownContent key={i} content={displayText} />;
          }

          return null;
        })}

        {/* Tool calls: completed ones wrap horizontally as chips per spec */}
        {(() => {
          const toolParts = message.parts.filter((part) => part.type === "dynamic-tool");
          if (toolParts.length === 0) return null;

          const hasRunning = toolParts.some(
            (part) => part.state === "input-streaming" || part.state === "input-available",
          );

          return (
            <div className={hasRunning ? "space-y-1" : "mt-1 flex flex-wrap gap-1.5"}>
              {toolParts.map((part) => (
                <ToolCallIndicator
                  key={part.toolCallId}
                  toolName={part.toolName}
                  state={part.state}
                  input={part.input}
                />
              ))}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
