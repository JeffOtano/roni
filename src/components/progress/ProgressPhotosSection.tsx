"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAnalytics } from "@/lib/analytics";
import type { Id } from "../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorAlert } from "@/components/ErrorAlert";
import { ProgressComparison } from "@/components/ProgressComparison";
import { ProgressPhotoItem } from "@/components/ProgressPhotoItem";
import { CheckCircle2, ImageIcon, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

const ACCEPTED_IMAGE_TYPES = "image/jpeg,image/png,image/webp";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function ProgressPhotosSection() {
  const { track } = useAnalytics();
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
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [thumbnailError, setThumbnailError] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (!confirmDeleteAll) return;
    const timer = setTimeout(() => setConfirmDeleteAll(false), 4000);
    return () => clearTimeout(timer);
  }, [confirmDeleteAll]);

  useEffect(() => {
    if (!list?.length) {
      setThumbnails({});
      setThumbnailError(false);
      return;
    }
    setThumbnailError(false);
    getListWithThumbnails()
      .then((result) => {
        const map: Record<string, string> = {};
        result.forEach((p) => {
          if (p.base64) map[p.id] = p.base64;
        });
        setThumbnails(map);
      })
      .catch(() => {
        setThumbnails({});
        setThumbnailError(true);
      });
  }, [list?.length, getListWithThumbnails]);

  const uploadFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        setErrorMessage("Please select an image file (JPEG, PNG, or WebP).");
        return;
      }
      setErrorMessage(null);
      setSuccessMessage(null);
      setUploading(true);
      try {
        const base64 = await fileToBase64(file);
        await uploadPhoto({ imageBase64: base64 });
        track("progress_photo_uploaded");
        setSuccessMessage("Photo uploaded successfully");
        setTimeout(() => setSuccessMessage(null), 3000);
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [uploadPhoto, track],
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
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) uploadFile(file);
    },
    [uploadFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDragOver(true);
  }, []);

  const handleDelete = useCallback(
    async (photoId: Id<"progressPhotos">) => {
      setErrorMessage(null);
      setDeletingId(photoId);
      try {
        await remove({ photoId });
        track("progress_photo_deleted");
        toast.success("Photo deleted");
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "Delete failed");
      } finally {
        setDeletingId(null);
      }
    },
    [remove, track],
  );

  const handleDeleteAll = useCallback(async () => {
    if (!list?.length) return;
    if (!confirmDeleteAll) {
      setConfirmDeleteAll(true);
      return;
    }
    setConfirmDeleteAll(false);
    setErrorMessage(null);
    setDeletingAll(true);
    try {
      await deleteAll({});
      toast.success("All photos deleted");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingAll(false);
    }
  }, [confirmDeleteAll, list?.length, deleteAll]);

  const hasPhotos = list && list.length > 0;
  const hasComparison =
    list && list.length >= 2 && thumbnails[list[list.length - 1].id] && thumbnails[list[0].id];

  useEffect(() => {
    if (hasComparison && list) {
      track("progress_photo_comparison_viewed", { photo_count: list.length });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasComparison]);

  return (
    <div>
      {errorMessage && (
        <div className="mb-4">
          <ErrorAlert message={errorMessage} onRetry={() => setErrorMessage(null)} />
        </div>
      )}
      {successMessage && (
        <div className="mb-4 flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-green-400 ring-1 ring-green-500/20 backdrop-blur-sm">
          <CheckCircle2 className="size-4 shrink-0 text-green-400" />
          {successMessage}
        </div>
      )}
      {/* Upload zone */}
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
            onDragLeave={() => setDragOver(false)}
            className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-10 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${dragOver ? "border-primary bg-primary/[0.06] shadow-[0_0_20px_rgba(0,200,200,0.1)]" : "border-border bg-muted/30 hover:border-primary/40 hover:bg-muted/50"}`}
          >
            {uploading ? (
              <Loader2 className="size-10 animate-spin text-primary/60" />
            ) : (
              <Upload className="size-10 text-muted-foreground motion-safe:animate-[pulse_3s_ease-in-out_infinite]" />
            )}
            <p className="mt-3 text-sm font-medium text-foreground">
              {uploading ? "Uploading..." : "Drop an image or click to upload"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">JPEG, PNG, or WebP</p>
          </div>
        </CardContent>
      </Card>
      {/* Photo comparison */}
      {hasComparison && (
        <ProgressComparison
          earliest={list[list.length - 1]}
          latest={list[0]}
          earliestThumb={thumbnails[list[list.length - 1].id]}
          latestThumb={thumbnails[list[0].id]}
        />
      )}
      {/* Photo grid */}
      {thumbnailError && hasPhotos && (
        <p className="mb-2 text-xs text-muted-foreground">
          Photo previews couldn&apos;t be loaded. Your photos are still saved.
        </p>
      )}
      {list === undefined ? (
        <p className="text-sm text-muted-foreground">Loading photos...</p>
      ) : list.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-14">
            <ImageIcon className="size-12 text-muted-foreground/50" />
            <p className="mt-3 text-sm font-medium text-muted-foreground">No photos yet</p>
            <p className="mt-1 text-xs text-muted-foreground">Upload one above to get started</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground">Your photos</h2>
            <Button
              variant={confirmDeleteAll ? "destructive" : "ghost"}
              size="sm"
              className={confirmDeleteAll ? "" : "text-destructive hover:text-destructive"}
              onClick={handleDeleteAll}
              disabled={deletingAll}
            >
              {deletingAll ? (
                <Loader2 className="size-4 animate-spin" />
              ) : confirmDeleteAll ? (
                "Confirm delete all?"
              ) : (
                "Delete all"
              )}
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {list.map((photo) => (
              <ProgressPhotoItem
                key={photo.id}
                photoId={photo.id as Id<"progressPhotos">}
                createdAt={photo.createdAt}
                thumbnail={thumbnails[photo.id]}
                deleting={deletingId === (photo.id as Id<"progressPhotos">)}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
