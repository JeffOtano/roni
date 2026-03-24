/**
 * Push notification sending via APNs.
 *
 * This is a skeleton action. Sending push notifications requires:
 * 1. An APNs key (.p8 file) from Apple Developer Portal
 * 2. The key ID, team ID, and bundle ID configured as environment variables
 * 3. JWT signing to authenticate with APNs
 *
 * Environment variables needed (set in Convex dashboard):
 *   APNS_KEY_ID      - Key ID from Apple Developer
 *   APNS_TEAM_ID     - Apple Developer Team ID
 *   APNS_KEY_BASE64  - Base64-encoded .p8 private key contents
 *   APNS_BUNDLE_ID   - App bundle ID (coach.tonal.app)
 *   APNS_ENVIRONMENT  - "development" or "production"
 */

"use node";

import { v } from "convex/values";
import { action, internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

/** Send a push notification to a specific user. */
export const sendToUser = internalAction({
  args: {
    userId: v.id("users"),
    title: v.string(),
    body: v.string(),
    category: v.optional(v.string()),
    data: v.optional(v.any()),
    badge: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Fetch the user's push tokens.
    const tokens: Array<{ token: string; platform: string }> = await ctx.runQuery(
      internal.notifications.tokenQuery.getTokensForUser,
      {
        userId: args.userId,
      },
    );

    if (tokens.length === 0) {
      console.log(`[send] No push tokens for user ${args.userId}`);
      return { sent: 0, failed: 0 };
    }

    let sent = 0;
    let failed = 0;

    for (const { token } of tokens) {
      try {
        await sendAPNs({
          deviceToken: token,
          title: args.title,
          body: args.body,
          category: args.category,
          data: args.data,
          badge: args.badge,
        });
        sent++;
      } catch (error) {
        console.error(`[send] Failed to send to token ${token.slice(0, 8)}...`, error);
        failed++;
      }
    }

    return { sent, failed };
  },
});

/** Send a push notification to multiple users (e.g. weekly recap). */
export const sendToUsers = internalAction({
  args: {
    userIds: v.array(v.id("users")),
    title: v.string(),
    body: v.string(),
    category: v.optional(v.string()),
    data: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    let totalSent = 0;
    let totalFailed = 0;

    for (const userId of args.userIds) {
      const result: { sent: number; failed: number } = await ctx.runAction(
        internal.notifications.send.sendToUser,
        {
          userId,
          title: args.title,
          body: args.body,
          category: args.category,
          data: args.data,
        },
      );
      totalSent += result.sent;
      totalFailed += result.failed;
    }

    return { sent: totalSent, failed: totalFailed };
  },
});

// MARK: - APNs Transport

interface APNsPayload {
  deviceToken: string;
  title: string;
  body: string;
  category?: string;
  data?: Record<string, unknown>;
  badge?: number;
}

/**
 * Sends a single push notification via the APNs HTTP/2 API.
 *
 * TODO: Implement JWT signing with the .p8 key. This requires:
 * - `jsonwebtoken` or `jose` package for ES256 signing
 * - Reading APNS_KEY_BASE64, APNS_KEY_ID, APNS_TEAM_ID from env
 * - Caching the JWT (valid for 1 hour per Apple docs)
 *
 * APNs endpoint:
 * - Development: https://api.sandbox.push.apple.com/3/device/{token}
 * - Production:  https://api.push.apple.com/3/device/{token}
 */
async function sendAPNs(payload: APNsPayload): Promise<void> {
  const environment = process.env.APNS_ENVIRONMENT ?? "development";
  const bundleId = process.env.APNS_BUNDLE_ID ?? "coach.tonal.app";

  const host =
    environment === "production"
      ? "https://api.push.apple.com"
      : "https://api.sandbox.push.apple.com";

  const url = `${host}/3/device/${payload.deviceToken}`;

  // TODO: Generate JWT bearer token for APNs authentication.
  // const jwt = await generateAPNsJWT();
  //
  // The JWT must be signed with ES256 using the .p8 private key:
  // Header: { alg: "ES256", kid: APNS_KEY_ID }
  // Payload: { iss: APNS_TEAM_ID, iat: now }

  const apnsPayload = {
    aps: {
      alert: {
        title: payload.title,
        body: payload.body,
      },
      sound: "default",
      badge: payload.badge ?? 0,
      ...(payload.category ? { category: payload.category } : {}),
    },
    ...(payload.data ?? {}),
  };

  // TODO: Uncomment when APNs credentials are configured.
  // const response = await fetch(url, {
  //   method: "POST",
  //   headers: {
  //     "authorization": `bearer ${jwt}`,
  //     "apns-topic": bundleId,
  //     "apns-push-type": "alert",
  //     "apns-priority": "10",
  //     "content-type": "application/json",
  //   },
  //   body: JSON.stringify(apnsPayload),
  // });
  //
  // if (!response.ok) {
  //   const errorBody = await response.text();
  //   throw new Error(`APNs error ${response.status}: ${errorBody}`);
  // }

  console.log(`[APNs] Would send to ${payload.deviceToken.slice(0, 8)}...:`, apnsPayload);
}
