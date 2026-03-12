"use client";

import { Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAction, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { ChatThread } from "@/components/ChatThread";
import { ChatInput } from "@/components/ChatInput";
import { Activity, Dumbbell, Sparkles, TrendingUp, Zap } from "lucide-react";

const suggestions = [
  { icon: Dumbbell, text: "Program me a workout for today" },
  { icon: TrendingUp, text: "How are my strength scores trending?" },
  { icon: Zap, text: "Which muscles are freshest right now?" },
  { icon: Activity, text: "Analyze my training this month" },
];

// Wrap in Suspense because useSearchParams requires it in Next.js 14+
export default function ChatPage() {
  return (
    <Suspense>
      <ChatPageInner />
    </Suspense>
  );
}

function ChatPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeThread = useQuery(api.threads.getCurrentThread);
  const sendMessage = useAction(api.chat.sendMessage);
  const me = useQuery(api.users.getMe);
  const autoSentRef = useRef(false);

  // Auto-send from ?prompt= query param (once only)
  const promptParam = searchParams.get("prompt");
  useEffect(() => {
    if (promptParam && !autoSentRef.current) {
      autoSentRef.current = true;
      router.replace("/chat");
      sendMessage({ prompt: promptParam });
    }
  }, [promptParam, router, sendMessage]);

  const hasThread = activeThread !== undefined && activeThread !== null;
  const userInitial = me?.tonalName?.charAt(0).toUpperCase() ?? "U";

  // Show welcome state when no thread/messages exist
  if (activeThread !== undefined && !hasThread && !promptParam) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex flex-1 flex-col items-center justify-center px-4">
          <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
            <Sparkles className="size-5 text-muted-foreground" />
          </div>
          <h2 className="mb-2 text-lg font-semibold text-foreground">
            What are we working on today?
          </h2>
          <p className="mb-6 max-w-sm text-center text-sm text-muted-foreground">
            I can check your readiness, program workouts, analyze trends, or just talk training.
          </p>
          <div className="grid w-full max-w-md grid-cols-2 gap-3">
            {suggestions.map(({ icon: Icon, text }) => (
              <button
                key={text}
                onClick={() => sendMessage({ prompt: text })}
                className="flex items-start gap-3 rounded-lg border border-border bg-card p-3 text-left text-sm text-foreground/80 transition-all hover:border-primary/30 hover:bg-card/80 active:scale-[0.98]"
              >
                <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>{text}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Input always visible even on welcome screen */}
        <div className="shrink-0 border-t border-border p-3 sm:p-4">
          <ChatInput />
        </div>
      </div>
    );
  }

  // Has messages — show ChatThread
  if (hasThread) {
    return <ChatThread threadId={activeThread.threadId} userInitial={userInitial} />;
  }

  // Loading state (activeThread is undefined = query still loading)
  return null;
}
