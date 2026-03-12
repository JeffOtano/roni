"use client";

import { useEffect, useRef } from "react";
import { useUIMessages } from "@convex-dev/agent/react";
import { api } from "../../convex/_generated/api";
import { ChatMessage } from "@/components/ChatMessage";
import { ChatInput } from "@/components/ChatInput";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface ChatThreadProps {
  threadId: string;
}

export function ChatThread({ threadId }: ChatThreadProps) {
  const { results, status, loadMore } = useUIMessages(
    api.chat.listMessages,
    { threadId },
    { initialNumItems: 20, stream: true }
  );

  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (results.length > prevMessageCountRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    prevMessageCountRef.current = results.length;
  }, [results.length]);

  // Also scroll when streaming content updates
  useEffect(() => {
    const lastMessage = results[results.length - 1];
    if (lastMessage?.status === "streaming") {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [results]);

  const isStreaming = results.some((m) => m.status === "streaming");

  return (
    <div className="flex h-full flex-col">
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4"
      >
        {status === "CanLoadMore" && (
          <div className="mb-4 flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => loadMore(20)}
            >
              Load more
            </Button>
          </div>
        )}

        {status === "LoadingMore" && (
          <div className="mb-4 flex justify-center">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        )}

        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          {results.map((message) => (
            <ChatMessage key={message.key} message={message} />
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl">
        <ChatInput threadId={threadId} disabled={isStreaming} />
      </div>
    </div>
  );
}
