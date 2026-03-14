"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sendMessage = useAction(api.chat.sendMessage);

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
    try {
      await sendMessage({ prompt: trimmed });
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
  }, [input, sending, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isDisabled = disabled || sending;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2 ring-1 ring-white/[0.08] transition-all duration-200 focus-within:border-primary/30 focus-within:ring-primary/20">
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
          className="flex-1 resize-none rounded-xl bg-transparent px-4 py-3 text-sm leading-6 text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 disabled:cursor-not-allowed disabled:opacity-50"
          style={{ height: "auto", maxHeight: "96px" }}
        />
        <Button
          size="icon-lg"
          onClick={handleSend}
          disabled={isDisabled || !input.trim()}
          aria-label="Send message"
          className="mb-0.5 rounded-xl shadow-md shadow-primary/20"
        >
          <SendHorizontal className="size-4" />
        </Button>
      </div>
      {error && (
        <p className="mt-2 rounded-lg bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
