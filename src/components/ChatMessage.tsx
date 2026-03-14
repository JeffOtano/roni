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
    <div className={`px-4 py-5 sm:px-6 sm:py-6 ${!isUser ? "border-l-2 border-primary/20" : ""}`}>
      {/* Header: avatar + role + timestamp */}
      <div className="mb-2 flex items-center gap-2.5">
        {isUser ? (
          <div className="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {userInitial}
          </div>
        ) : (
          <div className="flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[oklch(0.6_0.22_300)] shadow-sm shadow-primary/20">
            <Sparkles className="size-3.5 text-white" />
          </div>
        )}
        <span
          className={`text-xs font-medium ${isUser ? "text-muted-foreground" : "text-primary"}`}
        >
          {isUser ? "You" : "Coach"}
        </span>
        <span className="ml-auto text-[11px] text-muted-foreground/40">
          {formatTime(message._creationTime)}
        </span>
      </div>

      {/* Content -- indented to align with role name */}
      <div className="max-w-prose pl-[38px]">
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

        {/* Tool calls: completed ones wrap horizontally as chips */}
        {(() => {
          const toolParts = message.parts.filter((part) => part.type === "dynamic-tool");
          if (toolParts.length === 0) return null;

          const hasRunning = toolParts.some(
            (part) => part.state === "input-streaming" || part.state === "input-available",
          );

          return (
            <div className={hasRunning ? "space-y-1" : "mt-1.5 flex flex-wrap gap-1.5"}>
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
