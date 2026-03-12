"use client";

import { useRouter } from "next/navigation";
import { useAction } from "convex/react";
import { useState } from "react";
import { api } from "../../../convex/_generated/api";
import { ChatInput } from "@/components/ChatInput";
import { Dumbbell, BarChart3, Calendar, TrendingUp } from "lucide-react";

const SUGGESTIONS = [
  {
    text: "What should I train today?",
    icon: Dumbbell,
  },
  {
    text: "Analyze my training this month",
    icon: BarChart3,
  },
  {
    text: "Program me a leg day",
    icon: Calendar,
  },
  {
    text: "How are my strength scores trending?",
    icon: TrendingUp,
  },
] as const;

export default function ChatPage() {
  const router = useRouter();
  const sendMessage = useAction(api.chat.sendMessage);
  const [sending, setSending] = useState(false);

  const handleSuggestion = async (text: string) => {
    if (sending) return;
    setSending(true);

    try {
      const result = await sendMessage({ prompt: text });
      router.push(`/chat/${result.threadId}`);
    } catch (error) {
      console.error("Failed to send message:", error);
      setSending(false);
    }
  };

  const handleThreadCreated = (threadId: string) => {
    router.push(`/chat/${threadId}`);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-1 flex-col items-center justify-center px-4">
        <div className="mx-auto max-w-lg text-center">
          <h1 className="text-2xl font-semibold text-foreground">
            tonal.coach
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your AI personal trainer for Tonal. Ask me anything about your
            training, strength scores, or let me program a workout for you.
          </p>

          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {SUGGESTIONS.map(({ text, icon: Icon }) => (
              <button
                key={text}
                onClick={() => handleSuggestion(text)}
                disabled={sending}
                className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left text-sm text-card-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Icon className="size-4 shrink-0 text-muted-foreground" />
                <span>{text}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl">
        <ChatInput
          threadId={null}
          onThreadCreated={handleThreadCreated}
          disabled={sending}
        />
      </div>
    </div>
  );
}
