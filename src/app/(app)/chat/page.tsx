"use client";

import { Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAction, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { ChatThread } from "@/components/ChatThread";
import { ChatInput } from "@/components/ChatInput";
import { Activity, Dumbbell, Loader2, Sparkles, TrendingUp, Zap } from "lucide-react";

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
    const firstName = me?.tonalName?.split(" ")[0];

    return (
      <div className="flex h-full flex-col">
        <div className="flex flex-1 flex-col items-center justify-center px-4">
          <div className="mb-6 flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[oklch(0.6_0.22_300)]">
            <Sparkles className="size-6 text-white" />
          </div>

          <h2 className="mb-2 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            {firstName ? `Hey ${firstName}, what's the plan?` : "What are we working on today?"}
          </h2>
          <p className="mb-8 max-w-sm text-center text-sm leading-relaxed text-muted-foreground">
            I can check your readiness, program workouts, analyze trends, or just talk training.
          </p>

          <div className="grid w-full max-w-lg grid-cols-1 gap-2.5 sm:grid-cols-2">
            {suggestions.map(({ icon: Icon, text }) => (
              <button
                key={text}
                onClick={() => sendMessage({ prompt: text })}
                className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left text-sm text-foreground transition-colors duration-150 hover:bg-accent active:scale-[0.98]"
              >
                <Icon className="size-4 shrink-0 text-muted-foreground" />
                <span className="leading-snug">{text}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Input always visible even on welcome screen */}
        <div className="shrink-0 p-3 sm:p-4">
          <ChatInput />
        </div>
      </div>
    );
  }

  // Has messages -- show ChatThread
  if (hasThread) {
    return <ChatThread threadId={activeThread.threadId} userInitial={userInitial} />;
  }

  // Loading state (activeThread is undefined = query still loading)
  return (
    <div className="flex h-full items-center justify-center">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}
