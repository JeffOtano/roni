"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { useUIMessages } from "@convex-dev/agent/react";
import { toUIMessages } from "@convex-dev/agent";
import type { UIMessage } from "@convex-dev/agent/react";
import { api } from "../../convex/_generated/api";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { DateDivider } from "./DateDivider";

function isDifferentDay(a: number, b: number | null): boolean {
  if (!b) return true;
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getDate() !== db.getDate() ||
    da.getMonth() !== db.getMonth() ||
    da.getFullYear() !== db.getFullYear()
  );
}

function MessageList({ messages, userInitial }: { messages: UIMessage[]; userInitial?: string }) {
  return (
    <>
      {messages.map((message, i) => {
        const prev = i > 0 ? messages[i - 1]._creationTime : null;
        return (
          <div key={message.key}>
            {isDifferentDay(message._creationTime, prev) && (
              <DateDivider timestamp={message._creationTime} />
            )}
            <ChatMessage message={message} userInitial={userInitial} />
          </div>
        );
      })}
    </>
  );
}

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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: isStreaming ? "auto" : "smooth",
    });
  }, [allMessages.length, isStreaming]);

  const canLoadMoreHistory =
    history !== undefined && history.hasMore && historicalMessages.length === 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        {status === "CanLoadMore" && (
          <div className="flex justify-center py-3">
            <button
              onClick={() => loadMore(20)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Load earlier messages
            </button>
          </div>
        )}
        {status !== "CanLoadMore" && canLoadMoreHistory && (
          <div className="flex justify-center py-3">
            <button
              onClick={handleLoadEarlier}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Load earlier conversations
            </button>
          </div>
        )}
        <MessageList messages={allMessages} userInitial={userInitial} />
        <div ref={bottomRef} />
      </div>
      <div className="shrink-0 border-t border-border p-3 sm:p-4">
        <ChatInput disabled={isStreaming} />
      </div>
    </div>
  );
}
