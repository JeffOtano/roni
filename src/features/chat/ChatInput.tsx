"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { optimisticallySendMessage } from "@convex-dev/agent/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { ImagePreviewRow } from "./ImagePreviewRow";
import { FailureBanner, type FailureReason } from "@/features/byok/FailureBanner";
import { parseByokError } from "@/features/byok/parseByokError";
import { useImageUpload } from "@/hooks/useImageUpload";
import { ImagePlus, Loader2, SendHorizontal } from "lucide-react";
import { useAnalytics } from "@/lib/analytics";
import { getBrowserTimezone } from "@/lib/timezone";

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
  const [byokError, setByokError] = useState<FailureReason | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { pendingImages, addImages, removeImage, uploadAll, clearAll, isUploading } =
    useImageUpload();

  const generateUploadUrl = useMutation(api.chat.generateImageUploadUrl);
  const { track } = useAnalytics();

  const sendMessage = useMutation(api.chat.sendMessageToThread).withOptimisticUpdate(
    optimisticallySendMessage(api.chat.listMessages),
  );

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 4000);
    return () => clearTimeout(timer);
  }, [error]);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed && pendingImages.length === 0) return;
    if (sending) return;

    setSending(true);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    onSend?.(trimmed);

    try {
      // Upload images first if any are attached
      let imageStorageIds: Id<"_storage">[] | undefined;
      if (pendingImages.length > 0) {
        const ids = await uploadAll(async () => {
          const { uploadUrl } = await generateUploadUrl();
          return uploadUrl;
        });
        // Convex upload endpoint returns branded Id<"_storage"> values at runtime
        imageStorageIds = ids as Id<"_storage">[];
        clearAll();
      }

      await sendMessage({
        prompt: trimmed || "What do you see in these images?",
        threadId,
        userTimezone: getBrowserTimezone(),
        ...(imageStorageIds && imageStorageIds.length > 0 && { imageStorageIds }),
      });
      setByokError(null);
      track("message_sent", {
        message_length: trimmed.length,
        has_images: pendingImages.length > 0,
        image_count: pendingImages.length,
      });
    } catch (err) {
      setInput(trimmed);
      console.error("Failed to send message:", err);

      const byokReason = parseByokError(err);
      if (byokReason) {
        setByokError(byokReason);
        setError(null);
        return;
      }

      const message = err instanceof Error ? err.message.toLowerCase() : "";
      if (message.includes("dailymessages") || message.includes("daily")) {
        setError("You've hit your daily message limit. Come back tomorrow!");
      } else if (message.includes("rate") || message.includes("limit")) {
        setError("Sending too fast. Please wait a moment.");
      } else if (message.includes("upload")) {
        setError("Image upload failed. Please try again.");
      } else {
        setError("Message failed to send. Please try again.");
      }
    } finally {
      setSending(false);
    }
  }, [
    input,
    sending,
    pendingImages,
    sendMessage,
    threadId,
    onSend,
    uploadAll,
    generateUploadUrl,
    clearAll,
    track,
  ]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const validationError = addImages(e.target.files);
    if (validationError) setError(validationError);
    // Reset so the same file can be re-selected
    e.target.value = "";
  };

  const isDisabled = disabled || sending || isUploading;
  const hasContent = input.trim().length > 0 || pendingImages.length > 0;

  return (
    <div className="mx-auto w-full max-w-3xl">
      {byokError ? (
        <div className="mb-2">
          <FailureBanner reason={byokError} />
        </div>
      ) : (
        error && (
          <div
            role="alert"
            className="mb-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive"
          >
            {error}
          </div>
        )
      )}
      <div className="rounded-2xl border border-border bg-card p-2 shadow-sm transition-colors duration-200 focus-within:border-primary/40 focus-within:shadow-md focus-within:shadow-primary/5">
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
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              autoGrow(e.target);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Ask Roni..."
            disabled={isDisabled}
            rows={1}
            aria-label="Message input"
            className="min-w-0 flex-1 resize-none rounded-xl bg-transparent px-3 py-2.5 text-base leading-relaxed text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
            style={{ height: "auto", maxHeight: `${MAX_TEXTAREA_HEIGHT}px` }}
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
