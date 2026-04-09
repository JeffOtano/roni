"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const MAX_IMAGES = 4;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export interface PendingImage {
  readonly file: File;
  readonly previewUrl: string;
}

interface UseImageUploadReturn {
  readonly pendingImages: readonly PendingImage[];
  readonly addImages: (files: FileList) => string | null;
  readonly removeImage: (index: number) => void;
  readonly uploadAll: (generateUploadUrl: () => Promise<string>) => Promise<string[]>;
  readonly clearAll: () => void;
  readonly isUploading: boolean;
}

export function useImageUpload(): UseImageUploadReturn {
  const [pendingImages, setPendingImages] = useState<readonly PendingImage[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // Track all created object URLs for cleanup on unmount
  const createdUrlsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const urls = createdUrlsRef.current;
    return () => {
      for (const url of urls) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  const addImages = useCallback(
    (files: FileList): string | null => {
      const incoming = Array.from(files);

      // Validate: only image files
      const nonImages = incoming.filter((f) => !f.type.startsWith("image/"));
      if (nonImages.length > 0) {
        return "Only image files are allowed.";
      }

      // Validate: max total count
      const totalAfterAdd = pendingImages.length + incoming.length;
      if (totalAfterAdd > MAX_IMAGES) {
        return `You can attach up to ${MAX_IMAGES} images.`;
      }

      // Validate: file size
      const oversized = incoming.find((f) => f.size > MAX_FILE_SIZE_BYTES);
      if (oversized) {
        return "Each image must be under 10 MB.";
      }

      const newImages: PendingImage[] = incoming.map((file) => {
        const previewUrl = URL.createObjectURL(file);
        createdUrlsRef.current.add(previewUrl);
        return { file, previewUrl };
      });

      setPendingImages((prev) => [...prev, ...newImages]);
      return null;
    },
    [pendingImages.length],
  );

  const removeImage = useCallback((index: number) => {
    setPendingImages((prev) => {
      const removed = prev[index];
      if (removed) {
        URL.revokeObjectURL(removed.previewUrl);
        createdUrlsRef.current.delete(removed.previewUrl);
      }
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const clearAll = useCallback(() => {
    setPendingImages((prev) => {
      for (const img of prev) {
        URL.revokeObjectURL(img.previewUrl);
        createdUrlsRef.current.delete(img.previewUrl);
      }
      return [];
    });
  }, []);

  const uploadAll = useCallback(
    async (generateUploadUrl: () => Promise<string>): Promise<string[]> => {
      if (pendingImages.length === 0) return [];

      setIsUploading(true);
      try {
        const storageIds: string[] = [];

        for (const { file } of pendingImages) {
          const uploadUrl = await generateUploadUrl();
          const response = await fetch(uploadUrl, {
            method: "POST",
            headers: { "Content-Type": file.type },
            body: file,
          });

          if (!response.ok) {
            throw new Error(`Upload failed: ${response.statusText}`);
          }

          const { storageId } = (await response.json()) as {
            storageId: string;
          };
          storageIds.push(storageId);
        }

        return storageIds;
      } finally {
        setIsUploading(false);
      }
    },
    [pendingImages],
  );

  return {
    pendingImages,
    addImages,
    removeImage,
    uploadAll,
    clearAll,
    isUploading,
  };
}
