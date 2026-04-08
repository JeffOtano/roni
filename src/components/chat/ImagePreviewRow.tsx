"use client";

import type { PendingImage } from "@/hooks/useImageUpload";
import { X } from "lucide-react";
import Image from "next/image";

interface ImagePreviewRowProps {
  images: readonly PendingImage[];
  onRemove: (index: number) => void;
  disabled?: boolean;
}

export function ImagePreviewRow({ images, onRemove, disabled }: ImagePreviewRowProps) {
  if (images.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto px-1 pb-2" role="list" aria-label="Attached images">
      {images.map((img, index) => (
        <div key={img.previewUrl} role="listitem" className="group relative shrink-0">
          <Image
            src={img.previewUrl}
            alt={`Attachment ${index + 1}`}
            width={48}
            height={48}
            unoptimized
            className="size-12 rounded-lg border border-border object-cover"
          />
          <button
            type="button"
            onClick={() => onRemove(index)}
            disabled={disabled}
            aria-label={`Remove attachment ${index + 1}`}
            className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors duration-150 hover:bg-destructive hover:text-destructive-foreground disabled:pointer-events-none disabled:opacity-50"
          >
            <X className="size-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
