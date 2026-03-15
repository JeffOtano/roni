"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { useUIMessages } from "@convex-dev/agent/react";
import { toUIMessages } from "@convex-dev/agent";
import type { UIMessage } from "@convex-dev/agent/react";
import { api } from "../../convex/_generated/api";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { ChevronUp } from "lucide-react";

interface ChatThreadProps {
  userInitial?: string;
  threadId: string;
}

export function ChatThread({ userInitial, threadId }: ChatThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const {
    results: currentMessages,
    status,
    loadMore,
  } = useUIMessages(api.chat.listMessages, { threadId }, { initialNumItems: 20, stream: true });

  const [historicalMessages, setHistoricalMessages] = useState<UIMessage[]>([]);
  const history = useQuery(api.threads.listConversationHistory, {
    beforeThreadId: threadId,
  });

  const handleLoadEarlier = () => {
    if (!history || history.messages.length === 0) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const converted = toUIMessages(history.messages as any);
    setHistoricalMessages((prev) => [...converted, ...prev]);
  };

  const allMessages = [...historicalMessages, ...(currentMessages ?? [])];
  const isStreaming = (currentMessages ?? []).some((m) => m.status === "streaming");
  const lastMessage = allMessages[allMessages.length - 1];
  const isThinking = lastMessage?.role === "user" && !isStreaming;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: isStreaming ? "auto" : "smooth",
    });
  }, [allMessages.length, isStreaming, isThinking]);

  const canLoadMoreHistory =
    history !== undefined && history.hasMore && historicalMessages.length === 0;

  return (
    <div className="flex h-full flex-col">
      <div className="scrollbar-thin flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl">
          {status === "CanLoadMore" && (
            <div className="flex justify-center py-3">
              <button
                onClick={() => loadMore(20)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground"
              >
                <ChevronUp className="size-3" />
                Load earlier messages
              </button>
            </div>
          )}
          {status !== "CanLoadMore" && canLoadMoreHistory && (
            <div className="flex justify-center py-3">
              <button
                onClick={handleLoadEarlier}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground"
              >
                <ChevronUp className="size-3" />
                Load earlier conversations
              </button>
            </div>
          )}
          <MessageList messages={allMessages} userInitial={userInitial} threadId={threadId} />
          {isThinking && <ThinkingIndicator />}
          <div ref={bottomRef} className="h-4" />
        </div>
      </div>
      <div className="shrink-0 border-t border-border/50 p-3 sm:p-4">
        <ChatInput threadId={threadId} disabled={isStreaming} />
      </div>
    </div>
  );
}
