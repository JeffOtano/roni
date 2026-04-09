"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { useUIMessages } from "@convex-dev/agent/react";
import { toUIMessages } from "@convex-dev/agent";
import type { UIMessage } from "@convex-dev/agent/react";
import { api } from "../../../convex/_generated/api";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { ChevronDown, ChevronUp } from "lucide-react";

interface ChatThreadProps {
  userInitial?: string;
  threadId: string;
}

/**
 * Fake UIMessage shown instantly while waiting for the server to confirm.
 * Cleared once the real message appears in the query results.
 */
function makePendingMessage(text: string): UIMessage {
  return {
    key: `pending-${Date.now()}`,
    _creationTime: Date.now(),
    order: Number.MAX_SAFE_INTEGER,
    stepOrder: 0,
    status: "pending",
    role: "user",
    text,
    parts: [{ type: "text", text }],
  } as UIMessage;
}

export function ChatThread({ userInitial, threadId }: ChatThreadProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const {
    results: currentMessages,
    status,
    loadMore,
  } = useUIMessages(api.chat.listMessages, { threadId }, { initialNumItems: 20, stream: true });

  const [historicalMessages, setHistoricalMessages] = useState<UIMessage[]>([]);
  const [pendingText, setPendingText] = useState<string | null>(null);
  const history = useQuery(api.threads.listConversationHistory, {
    beforeThreadId: threadId,
  });

  const handleLoadEarlier = () => {
    if (!history || history.messages.length === 0) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const converted = toUIMessages(history.messages as any);
    setHistoricalMessages((prev) => [...converted, ...prev]);
  };

  // Show a local pending message until the server confirms it.
  // No cleanup needed — once serverHasPending is true, we just stop appending.
  const serverMessages = [...historicalMessages, ...(currentMessages ?? [])];
  const serverHasPending = pendingText
    ? serverMessages.some((m) => m.role === "user" && m.text === pendingText)
    : false;

  // Stable reference so React doesn't remount between pending and server message
  const pendingMessage = useMemo(
    () => (pendingText ? makePendingMessage(pendingText) : null),
    [pendingText],
  );

  const allMessages =
    pendingMessage && !serverHasPending ? [...serverMessages, pendingMessage] : serverMessages;

  const isStreaming = (currentMessages ?? []).some((m) => m.status === "streaming");
  const lastMessage = allMessages[allMessages.length - 1];

  // Show thinking dots until the coach produces visible text.
  const [mountTime] = useState(() => Date.now());
  const STALE_MS = 2 * 60 * 1000;

  const lastIsRecentUser =
    lastMessage?.role === "user" && lastMessage._creationTime > mountTime - STALE_MS;
  const lastIsAssistantWithoutText = lastMessage?.role === "assistant" && !lastMessage.text.trim();
  const isThinking = lastIsRecentUser || lastIsAssistantWithoutText;

  // Track whether the user has scrolled away from the bottom.
  const [showScrollButton, setShowScrollButton] = useState(false);
  const NEAR_BOTTOM_THRESHOLD = 150;

  const isNearBottom = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_THRESHOLD;
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "instant") => {
    const el = scrollContainerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  // Update FAB visibility on scroll.
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const handleScroll = () => setShowScrollButton(!isNearBottom());
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [isNearBottom]);

  // Scroll to bottom on initial mount.
  const hasMountScrolled = useRef(false);
  useEffect(() => {
    if (hasMountScrolled.current || !currentMessages?.length) return;
    hasMountScrolled.current = true;
    scrollToBottom("instant");
  }, [currentMessages, scrollToBottom]);

  // Auto-scroll during streaming / thinking — only if already near the bottom.
  // Prevents yanking user up during the pending→server swap or while reading history.
  const serverMessageCount = serverMessages.length;
  useEffect(() => {
    if (isNearBottom()) {
      scrollToBottom("smooth");
    }
  }, [serverMessageCount, isStreaming, isThinking, isNearBottom, scrollToBottom]);

  // Always scroll to bottom when the user sends a message.
  const handleSend = (text: string) => {
    setPendingText(text);
    scrollToBottom("smooth");
  };

  const canLoadMoreHistory =
    history !== undefined && history.hasMore && historicalMessages.length === 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={scrollContainerRef} className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
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
          <div role="log" aria-live="polite" aria-label="Chat messages">
            <MessageList messages={allMessages} userInitial={userInitial} threadId={threadId} />
          </div>
          {isThinking && <ThinkingIndicator />}
          <div ref={bottomRef} className="h-4" />
        </div>
      </div>
      <div className="relative shrink-0 border-t border-border/50 p-3 sm:p-4">
        {showScrollButton && (
          <button
            onClick={() => scrollToBottom("smooth")}
            aria-label="Scroll to latest messages"
            className="absolute -top-12 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-md transition-colors duration-150 hover:bg-accent hover:text-foreground"
          >
            <ChevronDown className="size-3" />
            Latest
          </button>
        )}
        <ChatInput threadId={threadId} disabled={isStreaming} onSend={handleSend} />
      </div>
    </div>
  );
}
