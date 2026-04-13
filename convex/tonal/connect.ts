import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { encryptToken, obtainTonalToken } from "./auth";
import { tonalFetch } from "./client";
import { CACHE_TTLS } from "./cache";
import { toUserProfileData } from "./profileData";
import type { TonalUser } from "./types";

export const connectTonal = internalAction({
  args: {
    userId: v.id("users"),
    tonalEmail: v.string(),
    tonalPassword: v.string(),
  },
  handler: async (ctx, { userId, tonalEmail, tonalPassword }) => {
    // 1. Obtain token from Auth0
    const { idToken, refreshToken, expiresAt } = await obtainTonalToken(tonalEmail, tonalPassword);

    // 2. Get Tonal user info (returns full profile)
    const profile = await tonalFetch<TonalUser>(idToken, "/v6/users/userinfo");
    const tonalUserId = profile.id;

    // 4. Encrypt tokens
    const keyHex = process.env.TOKEN_ENCRYPTION_KEY;
    if (!keyHex) {
      throw new Error("TOKEN_ENCRYPTION_KEY env var is not set");
    }

    const encryptedToken = await encryptToken(idToken, keyHex);
    const encryptedRefresh = refreshToken ? await encryptToken(refreshToken, keyHex) : undefined;

    // 5. Upsert user profile
    await ctx.runMutation(internal.userProfiles.create, {
      userId,
      tonalUserId,
      tonalEmail,
      tonalToken: encryptedToken,
      tonalRefreshToken: encryptedRefresh,
      tonalTokenExpiresAt: expiresAt,
      profileData: toUserProfileData(profile),
    });

    // 6. Seed movements table if empty (first user connecting)
    const existingMovements = await ctx.runQuery(internal.tonal.movementSync.getAllMovements);
    if (existingMovements.length === 0) {
      await ctx.runAction(internal.tonal.movementSync.syncMovementCatalog, {});
    }

    // 7. Cache user profile
    const now = Date.now();
    await ctx.runMutation(internal.tonal.cache.setCacheEntry, {
      userId,
      dataType: "profile",
      data: profile,
      fetchedAt: now,
      expiresAt: now + CACHE_TTLS.profile,
    });

    // 8. Notify Discord
    await ctx.runAction(internal.discord.notifyTonalConnection, {
      email: tonalEmail,
      tonalName: `${profile.firstName} ${profile.lastName}`,
    });

    // 9. Backfill historical training data (non-blocking)
    await ctx.scheduler.runAfter(0, internal.tonal.historySync.backfillUserHistory, {
      userId,
    });

    return { success: true, tonalUserId };
  },
});
