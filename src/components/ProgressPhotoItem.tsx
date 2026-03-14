"use client";

import type { Id } from "../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ImageIcon, Loader2, Trash2 } from "lucide-react";

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    year: "numeric",
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
    <Card>
      <CardContent className="flex items-center gap-4 p-3">
        <div className="size-16 shrink-0 overflow-hidden rounded-md bg-muted">
          {thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element -- base64 data URL
            <img
              src={`data:image/jpeg;base64,${thumbnail}`}
              alt=""
              className="size-full object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center">
              <ImageIcon className="size-6 text-muted-foreground" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">{formatDate(createdAt)}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Delete photo"
          className="shrink-0 text-destructive hover:text-destructive"
          onClick={() => onDelete(photoId)}
          disabled={deleting}
        >
          {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
        </Button>
      </CardContent>
    </Card>
  );
}
