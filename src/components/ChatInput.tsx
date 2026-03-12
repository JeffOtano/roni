"use client";

import { useRef, useState, useCallback } from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { SendHorizontal } from "lucide-react";

interface ChatInputProps {
  threadId: string | null;
  onThreadCreated?: (threadId: string) => void;
  disabled?: boolean;
}

export function ChatInput({
  threadId,
  onThreadCreated,
  disabled,
}: ChatInputProps) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sendMessage = useAction(api.chat.sendMessage);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;

    setSending(true);
    setInput("");

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      const result = await sendMessage({
        threadId: threadId ?? undefined,
        prompt: trimmed,
      });

      if (!threadId && result.threadId && onThreadCreated) {
        onThreadCreated(result.threadId);
      }
    } catch (error) {
      // Restore input on error so user can retry
      setInput(trimmed);
      console.error("Failed to send message:", error);
    } finally {
      setSending(false);
    }
  }, [input, sending, threadId, sendMessage, onThreadCreated]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // Auto-grow up to max 4 lines
    const el = e.target;
    el.style.height = "auto";
    const lineHeight = 24;
    const maxHeight = lineHeight * 4;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  };

  const isDisabled = disabled || sending;

  return (
    <div className="flex items-end gap-2 border-t border-border bg-background px-4 py-3">
      <textarea
        ref={textareaRef}
        value={input}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        placeholder="Ask your coach..."
        disabled={isDisabled}
        rows={1}
        className="flex-1 resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm leading-6 text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
        style={{ height: "auto", maxHeight: "96px" }}
      />
      <Button
        size="icon"
        onClick={handleSend}
        disabled={isDisabled || !input.trim()}
        aria-label="Send message"
      >
        <SendHorizontal className="size-4" />
      </Button>
    </div>
  );
}
