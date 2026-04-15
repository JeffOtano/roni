import type { ModelMessage } from "@ai-sdk/provider-utils";
import { components, internal } from "./_generated/api";
import type { ActionCtx, MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { type ProviderKeyResult, resolveProviderKey } from "./byok";
import { classifyByokError } from "./ai/resilience";

export const MAX_IMAGES_PER_MESSAGE = 4;

/**
 * Verifies the given user owns the given agent-component thread. Throws
 * if the thread does not exist or belongs to another user. Call this in
 * every public query/mutation/action that accepts a client-supplied
 * threadId, before doing any read or write against it.
 */
export async function assertThreadOwnership(
  ctx: QueryCtx | MutationCtx | ActionCtx,
  threadId: string,
  userId: string,
): Promise<void> {
  const thread = await ctx.runQuery(components.agent.threads.getThread, {
    threadId,
  });
  if (!thread || thread.userId !== userId) {
    throw new Error("Thread not found");
  }
}

// Like resolveUserProviderConfig but skips the quota check.
export async function validateUserProviderKey(ctx: ActionCtx, userId: string): Promise<void> {
  const context = await ctx.runQuery(internal.byok._getKeyResolutionContext, {
    userId: userId as Id<"users">,
  });
  if (!context) throw new Error("byok_user_not_found");
  await resolveProviderKey(context.profile, context.userCreationTime);
}

export async function resolveUserProviderConfig(
  ctx: ActionCtx,
  userId: string,
): Promise<ProviderKeyResult> {
  const context = await ctx.runQuery(internal.byok._getKeyResolutionContext, {
    userId: userId as Id<"users">,
  });
  if (!context) throw new Error("byok_user_not_found");
  const result = await resolveProviderKey(context.profile, context.userCreationTime);

  // Enforce monthly cap only when actually using the house key.
  const killSwitchActive = process.env.BYOK_DISABLED === "true";
  if (result.isHouseKey && !killSwitchActive) {
    try {
      await ctx.runMutation(internal.byok._checkHouseKeyQuota, {
        userId: userId as Id<"users">,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message.toLowerCase() : "";
      if (msg.includes("rate") || msg.includes("limit")) {
        throw new Error("house_key_quota_exhausted");
      }
      throw err;
    }
  }

  return result;
}

/**
 * Run an action body that calls the Gemini language model and sanitize any
 * raw error message into a typed BYOK error code before re-throwing. The
 * sanitization is critical because Google AI error bodies can echo the
 * decrypted API key back to us (for example "API key AIza... is invalid"),
 * and we MUST NOT log or surface that.
 *
 * If the underlying error is not BYOK-classifiable, it is re-thrown
 * unchanged so the existing transient-error handling can take over.
 */
export async function withByokErrorSanitization<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const code = classifyByokError(err);
    if (code !== null) {
      // Throw the sanitized code only. Never log or rethrow the raw message.
      throw new Error(code);
    }
    throw err;
  }
}

/**
 * Resolves storage IDs to URLs and builds a multimodal ModelMessage array.
 * Returns the plain text string when no images are provided.
 */
export async function buildPrompt(
  ctx: ActionCtx,
  text: string,
  imageStorageIds?: Id<"_storage">[],
): Promise<string | Array<ModelMessage>> {
  if (!imageStorageIds || imageStorageIds.length === 0) return text;

  if (imageStorageIds.length > MAX_IMAGES_PER_MESSAGE) {
    throw new Error(`Maximum ${MAX_IMAGES_PER_MESSAGE} images per message`);
  }

  const imageUrls = await Promise.all(
    imageStorageIds.map(async (storageId) => {
      const url = await ctx.storage.getUrl(storageId);
      if (!url) throw new Error(`Image not found: ${storageId}`);
      return url;
    }),
  );

  return [
    {
      role: "user" as const,
      content: [
        { type: "text" as const, text },
        ...imageUrls.map((url) => ({
          type: "image" as const,
          image: new URL(url),
        })),
      ],
    },
  ];
}
