// See spike-findings.md "Operator runbook: encryption key rotation" for the full procedure.
import { v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalAction, internalMutation, internalQuery } from "../_generated/server";
import { decrypt, encrypt } from "../tonal/encryption";

export async function rotatePhotoBlob(
  encoded: string,
  oldKey: string,
  newKey: string,
): Promise<string> {
  const plaintext = await decrypt(encoded, oldKey);
  return await encrypt(plaintext, newKey);
}

type ProgressPhotoRow = {
  _id: Id<"progressPhotos">;
  storageId: Id<"_storage">;
};

export const _listAll = internalQuery({
  args: {},
  handler: async (ctx): Promise<ProgressPhotoRow[]> => {
    const rows = await ctx.db.query("progressPhotos").collect();
    return rows.map((row) => ({ _id: row._id, storageId: row.storageId }));
  },
});

export const _updateStorageId = internalMutation({
  args: {
    photoId: v.id("progressPhotos"),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, { photoId, storageId }) => {
    await ctx.db.patch(photoId, { storageId });
  },
});

export const run = internalAction({
  args: {},
  handler: async (ctx) => {
    const oldKey = process.env.PROGRESS_PHOTOS_ENCRYPTION_KEY_OLD;
    const newKey = process.env.PROGRESS_PHOTOS_ENCRYPTION_KEY;

    if (!oldKey) {
      throw new Error("PROGRESS_PHOTOS_ENCRYPTION_KEY_OLD must be set for rotation");
    }
    if (!newKey) {
      throw new Error("PROGRESS_PHOTOS_ENCRYPTION_KEY must be set for rotation");
    }
    if (oldKey === newKey) {
      throw new Error(
        "PROGRESS_PHOTOS_ENCRYPTION_KEY_OLD and PROGRESS_PHOTOS_ENCRYPTION_KEY must differ",
      );
    }

    const rows: ProgressPhotoRow[] = await ctx.runQuery(
      internal.migrations.rotateProgressPhotoEncryptionKey._listAll,
      {},
    );

    let rotated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const row of rows) {
      try {
        const blob = await ctx.storage.get(row.storageId);
        if (!blob) {
          skipped += 1;
          errors.push(`${row._id}: storage blob missing`);
          continue;
        }

        const oldEncoded = await blob.text();
        const newEncoded = await rotatePhotoBlob(oldEncoded, oldKey, newKey);

        const newBlob = new Blob([newEncoded], { type: "text/plain" });
        const newStorageId = await ctx.storage.store(newBlob);

        await ctx.runMutation(
          internal.migrations.rotateProgressPhotoEncryptionKey._updateStorageId,
          { photoId: row._id, storageId: newStorageId },
        );
        await ctx.storage.delete(row.storageId);

        rotated += 1;
      } catch (err) {
        skipped += 1;
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`${row._id}: ${message}`);
      }
    }

    return { rotated, skipped, errors };
  },
});
