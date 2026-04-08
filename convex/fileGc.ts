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

    // Delete the underlying Convex storage objects first. If the deleteFiles
    // mutation below succeeds but a storage delete failed, the file row is
    // gone so we'd lose the reference - unrecoverable. Opposite order lets
    // a stale file row get retried on the next run.
    let storageDeleted = 0;
    for (const file of oldEnough) {
      try {
        await ctx.storage.delete(file.storageId as Id<"_storage">);
        storageDeleted++;
      } catch (err) {
        console.error(`fileGc: failed to delete storage ${file.storageId}:`, err);
      }
    }

    await ctx.runMutation(components.agent.files.deleteFiles, {
      fileIds: oldEnough.map((file) => file._id),
    });

    return { scanned: page.page.length, deleted: storageDeleted };
  },
});
