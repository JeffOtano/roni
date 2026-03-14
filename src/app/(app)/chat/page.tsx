"use client";

import { Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAction, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { ChatThread } from "@/components/ChatThread";
import { ChatInput } from "@/components/ChatInput";
import { Activity, Dumbbell, Loader2, Sparkles, TrendingUp, Zap } from "lucide-react";

const suggestions = [
  { icon: Dumbbell, text: "Program me a workout for today", colorVar: "var(--chart-1)" },
  { icon: TrendingUp, text: "How are my strength scores trending?", colorVar: "var(--chart-2)" },
  { icon: Zap, text: "Which muscles are freshest right now?", colorVar: "var(--chart-3)" },
  { icon: Activity, text: "Analyze my training this month", colorVar: "var(--chart-4)" },
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
          {/* Gradient icon container */}
          <div className="mb-6 flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[oklch(0.6_0.22_300)] shadow-lg shadow-primary/20">
            <Sparkles className="size-7 text-white" />
          </div>

          <h2 className="mb-2 text-2xl font-bold tracking-tight text-foreground">
            What are we working on today?
          </h2>
          <p className="mb-8 max-w-sm text-center text-sm leading-relaxed text-muted-foreground">
            I can check your readiness, program workouts, analyze trends, or just talk training.
          </p>

          <div className="grid w-full max-w-lg grid-cols-1 gap-3 sm:grid-cols-2">
            {suggestions.map(({ icon: Icon, text, colorVar }) => (
              <button
                key={text}
                onClick={() => sendMessage({ prompt: text })}
                className="group flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-left text-sm text-foreground/80 ring-1 ring-border/60 transition-all duration-200 hover:scale-[1.02] hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 active:scale-[0.98]"
                style={{ borderLeftWidth: "3px", borderLeftColor: colorVar }}
              >
                <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
                <span className="leading-relaxed">{text}</span>
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
