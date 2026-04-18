import { saveMessage } from "@convex-dev/agent";
import type { ModelMessage } from "@ai-sdk/provider-utils";
import { components, internal } from "./_generated/api";
import type { ActionCtx, MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { type ProviderKeyResult, resolveProviderKey } from "./byok";
import { buildByokErrorMessage, type ByokErrorCode, classifyByokError } from "./ai/resilience";
import type { ProviderId } from "./ai/providers";

export const MAX_IMAGES_PER_MESSAGE = 4;

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
 * Sanitize Gemini errors into typed BYOK codes before re-throwing.
 * Google AI error bodies can echo the decrypted API key back to us,
 * so we MUST NOT log or surface the raw message.
 */
export async function withByokErrorSanitization<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const code = classifyByokError(err);
    if (code !== null) {
      // Never log the raw message -- it may contain the decrypted API key.
      throw new Error(code);
    }
    throw err;
  }
}

const CHAT_ERROR_MESSAGE = "I'm having trouble right now. Please try again in a moment.";
const HOUSE_KEY_EXHAUSTED_MESSAGE =
  "You've used your 500 free AI messages this month. Add your own API key in Settings to keep going.";
const KEY_MISSING_MESSAGE = "You need to add an API key in Settings before chat can run.";
const MODEL_MISSING_MESSAGE =
  "The selected provider needs a model name before chat can start. Add one in Settings and try again.";

const BYOK_FALLBACK_MESSAGES: Record<ByokErrorCode, string> = {
  byok_key_invalid: "Your API key isn't working anymore. Check it in Settings and try again.",
  byok_quota_exceeded:
    "Your AI provider quota or credits are exhausted. Check billing or switch providers in Settings.",
  byok_safety_blocked: "The AI provider declined to answer this one. Try rephrasing.",
  byok_unknown_error: "Something went wrong with the AI provider. Try again in a moment.",
};

const EXPECTED_SCHEDULED_FAILURE_CODES = new Set<string>([
  "house_key_quota_exhausted",
  "byok_key_missing",
  "byok_model_missing",
  ...Object.keys(BYOK_FALLBACK_MESSAGES),
]);

export function getScheduledFailureContent(error: unknown, provider?: ProviderId): string {
  const code = error instanceof Error ? error.message : String(error);

  // Check explicit sentinel codes first so internal control-flow errors do not
  // get reinterpreted later by substring-based BYOK classification.
  if (code === "house_key_quota_exhausted") return HOUSE_KEY_EXHAUSTED_MESSAGE;
  if (code === "byok_key_missing") return KEY_MISSING_MESSAGE;
  if (code === "byok_model_missing") return MODEL_MISSING_MESSAGE;

  if (Object.prototype.hasOwnProperty.call(BYOK_FALLBACK_MESSAGES, code)) {
    return provider
      ? buildByokErrorMessage(code as ByokErrorCode, provider)
      : BYOK_FALLBACK_MESSAGES[code as ByokErrorCode];
  }

  if (provider) {
    const classified = classifyByokError(error);
    if (classified) return buildByokErrorMessage(classified, provider);
  }

  return CHAT_ERROR_MESSAGE;
}

export function shouldNotifyScheduledFailure(error: unknown): boolean {
  const code = error instanceof Error ? error.message : String(error);
  if (EXPECTED_SCHEDULED_FAILURE_CODES.has(code)) return false;
  return classifyByokError(error) === null;
}

export async function persistScheduledFailure(args: {
  ctx: ActionCtx;
  threadId: string;
  userId: string;
  error: unknown;
  provider?: ProviderId;
  source: string;
}): Promise<void> {
  await saveMessage(args.ctx, components.agent, {
    threadId: args.threadId,
    userId: args.userId,
    message: { role: "assistant", content: getScheduledFailureContent(args.error, args.provider) },
  });

  if (!shouldNotifyScheduledFailure(args.error)) return;

  const reason = args.error instanceof Error ? args.error.message : String(args.error);
  await args.ctx.runAction(internal.discord.notifyError, {
    source: args.source,
    message: reason,
    userId: args.userId,
  });
}

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
