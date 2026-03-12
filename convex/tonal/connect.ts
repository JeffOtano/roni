import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { obtainTonalToken, encryptToken } from "./auth";
import { tonalFetch } from "./client";
import { CACHE_TTLS } from "./cache";
import type { TonalUser, Movement } from "./types";

export const connectTonal = internalAction({
  args: {
    userId: v.id("users"),
    tonalEmail: v.string(),
    tonalPassword: v.string(),
  },
  handler: async (ctx, { userId, tonalEmail, tonalPassword }) => {
    // 1. Obtain token from Auth0
    const { idToken, refreshToken, expiresAt } = await obtainTonalToken(
      tonalEmail,
      tonalPassword,
    );

    // 2. Get Tonal user info (returns full profile)
    const profile = await tonalFetch<TonalUser>(
      idToken,
      "/v6/users/userinfo",
    );
    const tonalUserId = profile.id;

    // 4. Encrypt tokens
    const keyHex = process.env.TOKEN_ENCRYPTION_KEY;
    if (!keyHex) {
      throw new Error("TOKEN_ENCRYPTION_KEY env var is not set");
    }

    const encryptedToken = await encryptToken(idToken, keyHex);
    const encryptedRefresh = refreshToken
      ? await encryptToken(refreshToken, keyHex)
      : undefined;

    // 5. Upsert user profile
    await ctx.runMutation(internal.userProfiles.create, {
      userId,
      tonalUserId,
      tonalToken: encryptedToken,
      tonalRefreshToken: encryptedRefresh,
      tonalTokenExpiresAt: expiresAt,
      profileData: {
        firstName: profile.firstName,
        lastName: profile.lastName,
        heightInches: profile.heightInches,
        weightPounds: profile.weightPounds,
        gender: profile.gender,
        level: profile.tonalStatus,
        workoutsPerWeek: profile.workoutsPerWeek,
        workoutDurationMin: (profile as unknown as Record<string, number>).workoutDurationMin ?? 0,
        workoutDurationMax: (profile as unknown as Record<string, number>).workoutDurationMax ?? 0,
      },
    });

    // 6. Pre-cache movement catalog (global)
    const movements = await tonalFetch<Movement[]>(idToken, "/v6/movements");
    const now = Date.now();
    await ctx.runMutation(internal.tonal.cache.setCacheEntry, {
      userId: undefined,
      dataType: "movements",
      data: movements,
      fetchedAt: now,
      expiresAt: now + CACHE_TTLS.movements,
    });

    // 7. Cache user profile
    await ctx.runMutation(internal.tonal.cache.setCacheEntry, {
      userId,
      dataType: "profile",
      data: profile,
      fetchedAt: now,
      expiresAt: now + CACHE_TTLS.profile,
    });

    return { success: true, tonalUserId };
  },
});
