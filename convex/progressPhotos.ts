/** Progress photos: encrypted at rest, user-only. Requires PROGRESS_PHOTOS_ENCRYPTION_KEY (hex). */

import { v } from "convex/values";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { getEffectiveUserId } from "./lib/auth";
import { decrypt, encrypt } from "./tonal/encryption";

export const MAX_IMAGE_BASE64_LENGTH = 4 * 1024 * 1024;

function getEncryptionKey(): string {
  const key = process.env.PROGRESS_PHOTOS_ENCRYPTION_KEY;
  if (!key) throw new Error("PROGRESS_PHOTOS_ENCRYPTION_KEY env var is not set");
  return key;
}

export const create = internalMutation({
  args: {
    userId: v.id("users"),
    storageId: v.id("_storage"),
    createdAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("progressPhotos", args);
  },
});

export const getById = internalQuery({
  args: { photoId: v.id("progressPhotos") },
  handler: async (ctx, { photoId }) => {
    return await ctx.db.get(photoId);
  },
});

export const listByUserId = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("progressPhotos")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const upload = action({
  args: {
    imageBase64: v.string(),
  },
  handler: async (ctx, { imageBase64 }): Promise<{ photoId: string }> => {
    const userId = await ctx.runQuery(internal.lib.auth.resolveEffectiveUserId, {});
    if (!userId) throw new Error("Not authenticated");

    if (imageBase64.length > MAX_IMAGE_BASE64_LENGTH) {
      throw new Error("Image too large");
    }

    const keyHex = getEncryptionKey();
    const encrypted = await encrypt(imageBase64, keyHex);
    const blob = new Blob([encrypted], { type: "text/plain" });
    const storageId = await ctx.storage.store(blob);
    const createdAt = Date.now();

    const photoId = await ctx.runMutation(internal.progressPhotos.create, {
      userId,
      storageId,
      createdAt,
    });

    return { photoId };
  },
});

export const list = query({
  args: {},
  handler: async (ctx): Promise<{ id: string; createdAt: number }[]> => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) return [];

    const rows = await ctx.db
      .query("progressPhotos")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    return rows.map((r) => ({ id: r._id, createdAt: r.createdAt }));
  },
});

export const getPhoto = action({
  args: { photoId: v.id("progressPhotos") },
  handler: async (ctx, { photoId }): Promise<{ base64: string } | null> => {
    const userId = await ctx.runQuery(internal.lib.auth.resolveEffectiveUserId, {});
    if (!userId) throw new Error("Not authenticated");

    const row = await ctx.runQuery(internal.progressPhotos.getById, {
      photoId,
    });
    if (!row || row.userId !== userId) return null;

    const blob = await ctx.storage.get(row.storageId);
    if (!blob) return null;

    const encrypted = await blob.text();
    const keyHex = getEncryptionKey();
    const base64 = await decrypt(encrypted, keyHex);
    return { base64 };
  },
});

export const remove = mutation({
  args: { photoId: v.id("progressPhotos") },
  handler: async (ctx, { photoId }): Promise<void> => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const row = await ctx.db.get(photoId);
    if (!row || row.userId !== userId) {
      throw new Error("Progress photo not found or access denied");
    }

    await ctx.storage.delete(row.storageId);
    await ctx.db.delete(photoId);
  },
});

export const deleteAll = mutation({
  args: {},
  handler: async (ctx): Promise<void> => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const rows = await ctx.db
      .query("progressPhotos")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    for (const row of rows) {
      await ctx.storage.delete(row.storageId);
      await ctx.db.delete(row._id);
    }
  },
});

export const getAnalysisEnabled = query({
  args: {},
  handler: async (ctx): Promise<boolean> => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) return true;

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    return profile?.progressPhotoAnalysisEnabled !== false;
  },
});

export const updateAnalysisEnabled = mutation({
  args: { enabled: v.boolean() },
  handler: async (ctx, { enabled }): Promise<void> => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
    if (!profile) throw new Error("User profile not found");

    await ctx.db.patch(profile._id, { progressPhotoAnalysisEnabled: enabled });
  },
});

const LIST_THUMBNAILS_LIMIT = 30;

export const getListWithThumbnails = action({
  args: {},
  handler: async (ctx): Promise<{ id: string; createdAt: number; base64: string | null }[]> => {
    const userId = await ctx.runQuery(internal.lib.auth.resolveEffectiveUserId, {});
    if (!userId) return [];

    const rows = await ctx.runQuery(internal.progressPhotos.listByUserId, {
      userId,
    });
    const limited = rows.slice(0, LIST_THUMBNAILS_LIMIT);
    const keyHex = getEncryptionKey();

    const result: { id: string; createdAt: number; base64: string | null }[] = [];
    for (const row of limited) {
      const blob = await ctx.storage.get(row.storageId);
      let base64: string | null = null;
      if (blob) {
        try {
          const encrypted = await blob.text();
          base64 = await decrypt(encrypted, keyHex);
        } catch {
          // leave null on decrypt error
        }
      }
      result.push({
        id: row._id,
        createdAt: row.createdAt,
        base64,
      });
    }
    return result;
  },
});

const PROGRESS_PHOTO_COMPARE_SYSTEM = `Compare two progress photos for the same person. Brief factual observations only, relative to their own baseline. No negative body comments, weight mention, or body-shaming. 2–4 sentences. If no clear change, say so neutrally.`;

export const compareProgressPhotos = internalAction({
  args: {
    userId: v.id("users"),
    photoId1: v.id("progressPhotos"),
    photoId2: v.id("progressPhotos"),
  },
  handler: async (ctx, { userId, photoId1, photoId2 }): Promise<string> => {
    const [doc1, doc2, profile] = await Promise.all([
      ctx.runQuery(internal.progressPhotos.getById, { photoId: photoId1 }),
      ctx.runQuery(internal.progressPhotos.getById, { photoId: photoId2 }),
      ctx.runQuery(internal.userProfiles.getByUserId, { userId }),
    ]);

    if (!doc1 || doc1.userId !== userId || !doc2 || doc2.userId !== userId) {
      throw new Error("One or both photos not found or access denied");
    }
    if (profile?.progressPhotoAnalysisEnabled === false) {
      throw new Error("Photo analysis is disabled in settings");
    }

    const keyHex = getEncryptionKey();
    const [blob1, blob2] = await Promise.all([
      ctx.storage.get(doc1.storageId),
      ctx.storage.get(doc2.storageId),
    ]);
    if (!blob1 || !blob2) throw new Error("Photo data not found");

    const enc1 = await blob1.text();
    const enc2 = await blob2.text();
    const base64_1 = await decrypt(enc1, keyHex);
    const base64_2 = await decrypt(enc2, keyHex);

    const date1 = new Date(doc1.createdAt).toLocaleDateString();
    const date2 = new Date(doc2.createdAt).toLocaleDateString();

    const { text } = await generateText({
      model: google("gemini-3-flash-preview"),
      system: PROGRESS_PHOTO_COMPARE_SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Compare these two progress photos. First image is from ${date1}, second from ${date2}. Give brief factual observations about visible changes relative to the person's own baseline only.`,
            },
            {
              type: "image",
              image: `data:image/jpeg;base64,${base64_1}`,
            },
            {
              type: "image",
              image: `data:image/jpeg;base64,${base64_2}`,
            },
          ],
        },
      ],
    });

    return text;
  },
});

export const deleteAllForUser = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<void> => {
    const rows = await ctx.db
      .query("progressPhotos")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    for (const row of rows) {
      await ctx.storage.delete(row.storageId);
      await ctx.db.delete(row._id);
    }
  },
});
