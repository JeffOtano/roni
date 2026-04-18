"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { ImagePreviewRow } from "@/features/chat/ImagePreviewRow";
import { useImageUpload } from "@/hooks/useImageUpload";
import { useAnalytics } from "@/lib/analytics";
import { ImagePlus, Loader2, SendHorizontal } from "lucide-react";

export function WelcomeInput({
  sendMessage,
}: {
  sendMessage: (args: {
    prompt: string;
    imageStorageIds?: Id<"_storage">[];
  }) => Promise<{ threadId: string }>;
}) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { track } = useAnalytics();

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

    const imageCount = pendingImages.length;

    try {
      let imageStorageIds: Id<"_storage">[] | undefined;
      if (imageCount > 0) {
        const ids = await uploadAll(async () => {
          const { uploadUrl } = await generateUploadUrl();
          return uploadUrl;
        });
        imageStorageIds = ids as Id<"_storage">[];
        clearAll();
      }

      await sendMessage({
        prompt: trimmed || "What do you see in these images?",
        ...(imageStorageIds && imageStorageIds.length > 0 && { imageStorageIds }),
      });
      track("message_sent", {
        message_length: trimmed.length,
        has_images: imageCount > 0,
        image_count: imageCount,
      });
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
            placeholder="Ask Roni..."
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
