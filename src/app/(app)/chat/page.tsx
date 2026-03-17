"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { ChatThread } from "@/components/chat/ChatThread";
import { Button } from "@/components/ui/button";
import { ImagePreviewRow } from "@/components/chat/ImagePreviewRow";
import { useImageUpload } from "@/hooks/useImageUpload";
import {
  Activity,
  Dumbbell,
  ImagePlus,
  Loader2,
  SendHorizontal,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";

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
  const [waitingForCoach, setWaitingForCoach] = useState(false);

  // Wrap sendMessage to track loading state
  const sendAndWait = async (args: { prompt: string }) => {
    setWaitingForCoach(true);
    try {
      return await sendMessage(args);
    } finally {
      setWaitingForCoach(false);
    }
  };

  // Auto-send from ?prompt= query param (once only)
  const promptParam = searchParams.get("prompt");
  useEffect(() => {
    if (promptParam && !autoSentRef.current) {
      autoSentRef.current = true;
      router.replace("/chat");
      sendAndWait({ prompt: promptParam });
    }
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
                onClick={() => sendAndWait({ prompt: text })}
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

function WelcomeInput({
  sendMessage,
}: {
  sendMessage: (args: { prompt: string }) => Promise<{ threadId: string }>;
}) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { pendingImages, addImages, removeImage, uploadAll, clearAll, isUploading } =
    useImageUpload();

  const generateUploadUrl = useMutation(api.chat.generateImageUploadUrl);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(timer);
  }, [error]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed && pendingImages.length === 0) return;
    if (sending) return;

    setSending(true);
    setInput("");

    try {
      // Upload images first if any are attached
      if (pendingImages.length > 0) {
        await uploadAll(async () => {
          const { uploadUrl } = await generateUploadUrl();
          return uploadUrl;
        });
        clearAll();
      }

      // TODO: pass imageStorageIds once the sendMessage action supports them
      await sendMessage({ prompt: trimmed || "What do you see in these images?" });
    } catch {
      setInput(trimmed);
      setError("Message failed to send. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const validationError = addImages(e.target.files);
    if (validationError) setError(validationError);
    e.target.value = "";
  };

  const isDisabled = sending || isUploading;
  const hasContent = input.trim().length > 0 || pendingImages.length > 0;

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
      <div className="rounded-2xl border border-border bg-card p-2 shadow-sm">
        <ImagePreviewRow images={pendingImages} onRemove={removeImage} disabled={isDisabled} />
        <div className="flex items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            className="hidden"
            aria-hidden="true"
            tabIndex={-1}
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={isDisabled || pendingImages.length >= 4}
            aria-label="Attach images"
            className="mb-0.5 min-h-[44px] min-w-[44px] shrink-0 rounded-xl text-muted-foreground"
          >
            <ImagePlus className="size-4" />
          </Button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask your coach..."
            disabled={isDisabled}
            rows={1}
            aria-label="Message input"
            className="min-w-0 flex-1 resize-none rounded-xl bg-transparent px-3 py-2.5 text-base leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/60 disabled:opacity-50 sm:text-sm"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={isDisabled || !hasContent}
            aria-label={sending || isUploading ? "Sending message" : "Send message"}
            className="mb-0.5 min-h-[44px] min-w-[44px] shrink-0 rounded-xl"
          >
            {sending || isUploading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <SendHorizontal className="size-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
