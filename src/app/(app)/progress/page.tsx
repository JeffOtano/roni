"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorAlert } from "@/components/ErrorAlert";
import { ImageIcon, Loader2, Trash2, Upload } from "lucide-react";

const ACCEPTED_IMAGE_TYPES = "image/jpeg,image/png,image/webp";

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1];
      resolve(base64 ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ProgressPage() {
  const list = useQuery(api.progressPhotos.list, {});
  const getListWithThumbnails = useAction(api.progressPhotos.getListWithThumbnails);
  const uploadPhoto = useAction(api.progressPhotos.upload);
  const remove = useMutation(api.progressPhotos.remove);
  const deleteAll = useMutation(api.progressPhotos.deleteAll);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<Id<"progressPhotos"> | null>(null);
  const [deletingAll, setDeletingAll] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!list?.length) {
      setThumbnails({});
      return;
    }
    getListWithThumbnails()
      .then((result) => {
        const map: Record<string, string> = {};
        result.forEach((p) => {
          if (p.base64) map[p.id] = p.base64;
        });
        setThumbnails(map);
      })
      .catch(() => setThumbnails({}));
  }, [list?.length, getListWithThumbnails]);

  const uploadFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        setErrorMessage("Please select an image file (JPEG, PNG, or WebP).");
        return;
      }
      setErrorMessage(null);
      setUploading(true);
      try {
        const base64 = await fileToBase64(file);
        await uploadPhoto({ imageBase64: base64 });
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [uploadPhoto],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) uploadFile(file);
      e.target.value = "";
    },
    [uploadFile],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (file) uploadFile(file);
    },
    [uploadFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const handleDelete = useCallback(
    async (photoId: Id<"progressPhotos">) => {
      setErrorMessage(null);
      setDeletingId(photoId);
      try {
        await remove({ photoId });
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "Delete failed");
      } finally {
        setDeletingId(null);
      }
    },
    [remove],
  );

  const handleDeleteAll = useCallback(async () => {
    if (!list?.length || !confirm("Delete all progress photos? This cannot be undone.")) return;
    setErrorMessage(null);
    setDeletingAll(true);
    try {
      await deleteAll({});
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingAll(false);
    }
  }, [list?.length, deleteAll]);

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground">Progress photos</h1>
        <p className="text-sm text-muted-foreground">
          Upload photos to track visible changes over time. Only you can see them.
        </p>
      </div>

      {errorMessage && (
        <div className="mb-4">
          <ErrorAlert message={errorMessage} onRetry={() => setErrorMessage(null)} />
        </div>
      )}

      <Card className="mb-6">
        <CardContent className="p-4">
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_IMAGE_TYPES}
            onChange={handleFileChange}
            className="sr-only"
            aria-label="Choose image"
          />
          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 py-8 transition-colors hover:border-primary/50 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {uploading ? (
              <Loader2 className="size-10 animate-spin text-muted-foreground" />
            ) : (
              <Upload className="size-10 text-muted-foreground" />
            )}
            <p className="mt-2 text-sm font-medium text-foreground">
              {uploading ? "Uploading…" : "Drop an image or click to upload"}
            </p>
            <p className="text-xs text-muted-foreground">JPEG, PNG, or WebP</p>
          </div>
        </CardContent>
      </Card>

      {list === undefined ? (
        <p className="text-sm text-muted-foreground">Loading photos…</p>
      ) : list.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ImageIcon className="size-12 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">No photos yet</p>
            <p className="text-xs text-muted-foreground">Upload one above to get started</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground">Your photos</h2>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={handleDeleteAll}
              disabled={deletingAll}
            >
              {deletingAll ? <Loader2 className="size-4 animate-spin" /> : "Delete all"}
            </Button>
          </div>
          <ul className="space-y-3">
            {list.map((photo) => (
              <li key={photo.id}>
                <Card>
                  <CardContent className="flex items-center gap-4 p-3">
                    <div className="size-16 shrink-0 overflow-hidden rounded-md bg-muted">
                      {thumbnails[photo.id] ? (
                        // eslint-disable-next-line @next/next/no-img-element -- base64 data URL
                        <img
                          src={`data:image/jpeg;base64,${thumbnails[photo.id]}`}
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
                      <p className="text-sm font-medium text-foreground">
                        {formatDate(photo.createdAt)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(photo.id as Id<"progressPhotos">)}
                      disabled={deletingId === (photo.id as Id<"progressPhotos">)}
                      aria-label="Delete photo"
                    >
                      {deletingId === (photo.id as Id<"progressPhotos">) ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Trash2 className="size-4" />
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
