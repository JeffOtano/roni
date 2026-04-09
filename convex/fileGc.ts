import { z } from "zod";
import { internalAction } from "./_generated/server";
import { components } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

/**
 * Drain the @convex-dev/agent component's zero-refcount file queue.
 *
 * The agent tracks chat-image files with a refcount. When a message that
 * references a file is deleted (including via account deletion), the
 * refcount drops. Files at refcount 0 land in `getFilesToDelete`, but the
 * component only removes its own tracking row - the underlying Convex
 * `_storage` object is the caller's responsibility to clean up. That means
 * without this cron, deleted chat images leak storage forever.
 *
 * Runs every 6 hours, processes up to one page per run, ignores files
 * touched within the last 24 hours (per the component's recommendation)
 * to avoid racing uploads that haven't been linked to a message yet.
 */
const PAGE_SIZE = 100;
const MIN_AGE_MS = 24 * 60 * 60 * 1000;

// Zod-backed validation at the agent-component boundary where storageId
// arrives as an untyped `string`. Convex storage IDs are opaque
// lowercase-alphanumeric tokens with a bounded length.
const storageIdSchema = z.custom<Id<"_storage">>(
  (value) => typeof value === "string" && /^[a-z0-9]{20,}$/.test(value),
);

function asStorageId(value: string): Id<"_storage"> | null {
  const parsed = storageIdSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export const vacuumUnusedFiles = internalAction({
  args: {},
  handler: async (ctx) => {
    const page = await ctx.runQuery(components.agent.files.getFilesToDelete, {
      paginationOpts: { cursor: null, numItems: PAGE_SIZE },
    });

    const cutoff = Date.now() - MIN_AGE_MS;
    const oldEnough = page.page.filter((file) => file.lastTouchedAt < cutoff);
    if (oldEnough.length === 0) {
      return { scanned: page.page.length, deleted: 0 };
    }

    // Delete underlying Convex storage objects first, then remove the
    // agent's tracking rows ONLY for files whose storage delete succeeded.
    // If we deleted the tracking rows for failed storage deletes too, the
    // orphaned bytes would become unreachable on the next run (no row
    // means nothing to retry), stranding storage forever.
    const succeededFileIds: string[] = [];
    for (const file of oldEnough) {
      const storageId = asStorageId(file.storageId);
      if (storageId === null) {
        console.error(`fileGc: malformed storageId ${file.storageId}, skipping`);
        continue;
      }
      try {
        await ctx.storage.delete(storageId);
        succeededFileIds.push(file._id);
      } catch (err) {
        console.error(`fileGc: failed to delete storage ${file.storageId}:`, err);
      }
    }

    if (succeededFileIds.length > 0) {
      await ctx.runMutation(components.agent.files.deleteFiles, {
        fileIds: succeededFileIds,
      });
    }

    return { scanned: page.page.length, deleted: succeededFileIds.length };
  },
});
