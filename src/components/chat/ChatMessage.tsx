"use client";

import type { UIMessage } from "@convex-dev/agent/react";
import { useSmoothText } from "@convex-dev/agent/react";
import { MarkdownContent } from "@/components/chat/MarkdownContent";
import { ToolApprovalCard } from "@/components/chat/ToolApprovalCard";
import { ToolCallIndicator } from "@/components/chat/ToolCallIndicator";
import { WeekPlanCard } from "@/components/chat/WeekPlanCard";
import { weekPlanPresentationSchema } from "../../../convex/ai/schemas";
import { Sparkles } from "lucide-react";

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

function extractWeekPlan(text: string) {
  const match = text.match(/```week-plan\s*\n([\s\S]*?)\n```/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]);
    return weekPlanPresentationSchema.parse(parsed);
  } catch {
    return null;
  }
}

function SmoothAssistantText({ text, isStreaming }: { text: string; isStreaming: boolean }) {
  const [smoothText] = useSmoothText(text, {
    charsPerSec: 60,
    startStreaming: isStreaming,
  });

  const displayText = isStreaming ? smoothText + "\u258D" : text;
  return <MarkdownContent content={displayText} />;
}

interface ChatMessageProps {
  message: UIMessage;
  userInitial?: string;
  /** Whether the previous message was from the same role (enables grouping) */
  isGrouped?: boolean;
  threadId: string;
}

export function ChatMessage({ message, userInitial = "U", isGrouped, threadId }: ChatMessageProps) {
  const isUser = message.role === "user";
  const isStreaming = message.status === "streaming";

  // User messages: right-aligned bubble
  if (isUser) {
    return (
      <div
        className={`group relative flex justify-end px-4 sm:px-6 ${isGrouped ? "pt-1" : "pt-3"} pb-1`}
      >
        <div className="max-w-[80%]">
          {!isGrouped && (
            <div className="mb-1 flex items-center justify-end gap-2">
              <span className="text-xs text-muted-foreground">
                {formatTime(message._creationTime)}
              </span>
            </div>
          )}
          <div className="rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5">
            {message.parts.map((part, i) =>
              part.type === "text" ? (
                <p
                  key={i}
                  className="whitespace-pre-wrap text-sm leading-relaxed text-primary-foreground"
                >
                  {part.text}
                </p>
              ) : null,
            )}
          </div>
        </div>
      </div>
    );
  }

  // Coach messages: left-aligned with avatar
  return (
    <div className={`group relative px-4 sm:px-6 ${isGrouped ? "pt-1" : "pt-4"} pb-1`}>
      {!isGrouped && (
        <div className="mb-1.5 flex items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[oklch(0.6_0.22_300)]">
            <Sparkles className="size-3 text-white" />
          </div>
          <span className="text-[13px] font-semibold text-foreground">Coach</span>
          <span className="text-xs text-muted-foreground">{formatTime(message._creationTime)}</span>
        </div>
      )}

      <div className="sm:pl-8">
        {message.parts.map((part, i) => {
          if (part.type === "text") {
            const text = part.text;
            if (!text && !isStreaming) return null;

            // Coach: check for structured week plan
            const plan = extractWeekPlan(text);
            if (plan && !isStreaming) {
              const remainingText = text.replace(/```week-plan\s*\n[\s\S]*?\n```/, "").trim();
              return (
                <div key={i}>
                  <WeekPlanCard plan={plan} />
                  {remainingText && <MarkdownContent content={remainingText} />}
                </div>
              );
            }

            // Coach: render with smooth streaming
            return <SmoothAssistantText key={i} text={text} isStreaming={isStreaming} />;
          }

          if (
            part.type === "dynamic-tool" &&
            part.state === "approval-requested" &&
            part.approval
          ) {
            return (
              <ToolApprovalCard
                key={`approval-${part.toolCallId}`}
                toolName={part.toolName}
                input={part.input}
                approvalId={part.approval.id}
                threadId={threadId}
              />
            );
          }

          if (
            part.type === "dynamic-tool" &&
            (part.state === "approval-responded" || part.state === "output-denied") &&
            part.approval
          ) {
            const approved = part.approval.approved;
            return (
              <span
                key={`approval-response-${part.toolCallId}`}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs ${
                  approved
                    ? "bg-green-500/10 text-green-600 dark:text-green-400"
                    : "bg-destructive/10 text-destructive"
                }`}
              >
                {approved ? "\u2713 Approved" : "\u2717 Denied"}
              </span>
            );
          }

          return null;
        })}

        {/* Tool calls */}
        {(() => {
          const toolParts = message.parts.filter((part) => part.type === "dynamic-tool");
          if (toolParts.length === 0) return null;

          return (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
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

      {/* Hover timestamp for grouped messages */}
      {isGrouped && (
        <span className="pointer-events-none absolute left-1 top-1/2 hidden -translate-y-1/2 text-[10px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 sm:block">
          {formatTime(message._creationTime)}
        </span>
      )}
    </div>
  );
}
