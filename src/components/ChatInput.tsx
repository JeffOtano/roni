"use client";

import { useCallback, useRef, useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { SendHorizontal } from "lucide-react";

function autoGrow(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${Math.min(el.scrollHeight, 96)}px`;
}

interface ChatInputProps {
  disabled?: boolean;
}

export function ChatInput({ disabled }: ChatInputProps) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sendMessage = useAction(api.chat.sendMessage);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    try {
      await sendMessage({ prompt: trimmed });
    } catch (error) {
      setInput(trimmed);
      console.error("Failed to send message:", error);
    } finally {
      setSending(false);
    }
  }, [input, sending, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isDisabled = disabled || sending;

  return (
    <div className="flex items-end gap-2 bg-background">
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
