"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { optimisticallySendMessage } from "@convex-dev/agent/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Loader2, SendHorizontal } from "lucide-react";

const MAX_TEXTAREA_HEIGHT = 160;

function autoGrow(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
}

interface ChatInputProps {
  threadId: string;
  disabled?: boolean;
  onSend?: (text: string) => void;
}

export function ChatInput({ threadId, disabled, onSend }: ChatInputProps) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const sendMessage = useMutation(api.chat.sendMessageMutation).withOptimisticUpdate(
    optimisticallySendMessage(api.chat.listMessages),
  );

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(timer);
  }, [error]);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    onSend?.(trimmed);
    try {
      await sendMessage({ prompt: trimmed, threadId });
    } catch (err) {
      setInput(trimmed);
      console.error("Failed to send message:", err);
      const message = err instanceof Error ? err.message.toLowerCase() : "";
      if (message.includes("rate") || message.includes("limit")) {
        setError("Sending too fast. Please wait a moment.");
      } else {
        setError("Message failed to send. Please try again.");
      }
    } finally {
      setSending(false);
    }
  }, [input, sending, sendMessage, threadId, onSend]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isDisabled = disabled || sending;
  const hasInput = input.trim().length > 0;

  return (
    <div className="mx-auto w-full max-w-3xl">
      {error && (
        <div
          role="alert"
          className="mb-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive"
        >
          {error}
        </div>
      )}
      <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm transition-colors duration-200 focus-within:border-primary/40 focus-within:shadow-md focus-within:shadow-primary/5">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            autoGrow(e.target);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Ask your coach..."
          disabled={isDisabled}
          rows={1}
          aria-label="Message input"
          className="flex-1 resize-none rounded-xl bg-transparent px-3 py-2.5 text-sm leading-relaxed text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ height: "auto", maxHeight: `${MAX_TEXTAREA_HEIGHT}px` }}
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={isDisabled || !hasInput}
          aria-label={sending ? "Sending message" : "Send message"}
          className="mb-0.5 min-h-[44px] min-w-[44px] rounded-xl"
        >
          {sending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <SendHorizontal className="size-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
