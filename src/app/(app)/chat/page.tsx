"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAction, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { ChatThread } from "@/features/chat/ChatThread";
import { useAnalytics } from "@/lib/analytics";
import { Activity, Dumbbell, Flame, Loader2, Sparkles, TrendingUp, Zap } from "lucide-react";
import { WelcomeInput } from "./WelcomeInput";

const SEND_ERROR_MESSAGE = "Could not send your message. Please try again.";

const suggestions = [
  { icon: Dumbbell, text: "Program me a workout for today" },
  { icon: TrendingUp, text: "How are my strength scores trending?" },
  { icon: Zap, text: "Which muscles are freshest right now?" },
  { icon: Activity, text: "Analyze my training this month" },
  { icon: Flame, text: "Add eccentrics and chains to my next workout" },
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
  const createThreadWithMessage = useAction(api.chat.createThreadWithMessage);
  const me = useQuery(api.users.getMe);
  const autoSentRef = useRef(false);
  const mountedRef = useRef(true);
  const [waitingForCoach, setWaitingForCoach] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const { track } = useAnalytics();

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Wrap createThreadWithMessage to track loading state for the welcome flow.
  const sendAndWait = async (args: { prompt: string; imageStorageIds?: Id<"_storage">[] }) => {
    if (mountedRef.current) setSendError(null);
    if (mountedRef.current) setWaitingForCoach(true);
    try {
      return await createThreadWithMessage(args);
    } finally {
      if (mountedRef.current) setWaitingForCoach(false);
    }
  };

  // Auto-send from ?prompt= query param (once only)
  const promptParam = searchParams.get("prompt");
  useEffect(() => {
    if (!promptParam || autoSentRef.current) return;
    autoSentRef.current = true;
    router.replace("/chat");

    void (async () => {
      try {
        await sendAndWait({ prompt: promptParam });
      } catch (err) {
        console.error("Auto-send failed:", err);
        // Reset so the user can manually retry the same prompt from the input.
        autoSentRef.current = false;
        if (mountedRef.current) {
          setSendError(SEND_ERROR_MESSAGE);
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promptParam, router]);

  const hasThread = activeThread !== undefined && activeThread !== null;
  const userInitial = me?.tonalName?.charAt(0).toUpperCase() ?? "U";

  // Waiting for first response -- show thinking state
  if (waitingForCoach && !hasThread) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center gap-3 px-4">
        <div className="flex size-14 items-center justify-center rounded-full bg-linear-to-br from-primary to-[oklch(0.6_0.22_300)]">
          <Sparkles className="size-6 text-white" />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="inline-block size-2 rounded-full bg-foreground/30 motion-safe:animate-[thinking-dot_1.4s_ease-in-out_infinite]" />
            <span className="inline-block size-2 rounded-full bg-foreground/30 motion-safe:animate-[thinking-dot_1.4s_ease-in-out_0.2s_infinite]" />
            <span className="inline-block size-2 rounded-full bg-foreground/30 motion-safe:animate-[thinking-dot_1.4s_ease-in-out_0.4s_infinite]" />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">Your coach is reviewing your data...</p>
      </div>
    );
  }

  // Show welcome state when no thread/messages exist
  if (activeThread !== undefined && !hasThread && !promptParam) {
    const firstName = me?.tonalName?.split(" ")[0];

    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4">
          <div className="mb-6 flex size-14 items-center justify-center rounded-full bg-linear-to-br from-primary to-[oklch(0.6_0.22_300)]">
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
                onClick={() => {
                  track("suggestion_tapped", { suggestion_text: text });
                  sendAndWait({ prompt: text }).catch((err: unknown) => {
                    console.error("Suggestion send failed:", err);
                    if (mountedRef.current) {
                      setSendError(SEND_ERROR_MESSAGE);
                    }
                  });
                }}
                className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left text-sm text-foreground transition-colors duration-150 hover:bg-accent active:scale-[0.98]"
              >
                <Icon className="size-4 shrink-0 text-muted-foreground" />
                <span className="leading-snug">{text}</span>
              </button>
            ))}
          </div>

          {sendError && (
            <p className="mt-4 text-sm text-destructive" role="alert">
              {sendError}
            </p>
          )}
        </div>

        {/* Input always visible even on welcome screen */}
        <div className="shrink-0 p-3 sm:p-4">
          <WelcomeInput sendMessage={sendAndWait} />
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
    <div className="flex h-full items-center justify-center" role="status">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
      <span className="sr-only">Loading chat...</span>
    </div>
  );
}
