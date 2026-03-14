"use client";

import type { Id } from "../../convex/_generated/dataModel";
import { ImageIcon, Loader2, Trash2 } from "lucide-react";

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

interface ProgressPhotoItemProps {
  readonly photoId: Id<"progressPhotos">;
  readonly createdAt: number;
  readonly thumbnail: string | undefined;
  readonly deleting: boolean;
  readonly onDelete: (id: Id<"progressPhotos">) => void;
}

export function ProgressPhotoItem({
  photoId,
  createdAt,
  thumbnail,
  deleting,
  onDelete,
}: ProgressPhotoItemProps) {
  return (
    <div className="group/tile relative aspect-square overflow-hidden rounded-xl ring-1 ring-white/[0.08] transition-all duration-200 hover:ring-white/[0.18]">
      {thumbnail ? (
        // eslint-disable-next-line @next/next/no-img-element -- base64 data URL
        <img
          src={`data:image/jpeg;base64,${thumbnail}`}
          alt=""
          className="size-full object-cover"
        />
      ) : (
        <div className="flex size-full items-center justify-center bg-muted">
          <ImageIcon className="size-8 text-muted-foreground" />
        </div>
      )}
      {/* Gradient scrim with date */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent px-2.5 pb-2 pt-6">
        <p className="text-xs font-medium text-white/90">{formatDate(createdAt)}</p>
      </div>
      {/* Delete button overlay */}
      <button
        aria-label="Delete photo"
        className="absolute right-1.5 top-1.5 flex size-7 items-center justify-center rounded-lg bg-black/50 text-white/70 opacity-0 backdrop-blur-sm transition-all duration-200 hover:bg-destructive hover:text-white focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover/tile:opacity-100"
        onClick={() => onDelete(photoId)}
        disabled={deleting}
      >
        {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
      </button>
    </div>
  );
}
