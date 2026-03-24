/**
 * Push notification sending via APNs.
 *
 * Requires these environment variables (set in Convex dashboard):
 *   APNS_KEY_ID      - Key ID from Apple Developer
 *   APNS_TEAM_ID     - Apple Developer Team ID
 *   APNS_KEY_BASE64  - Base64-encoded .p8 private key contents
 *   APNS_BUNDLE_ID   - App bundle ID (coach.tonal.app)
 *   APNS_ENVIRONMENT - "development" or "production"
 */

"use node";

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";

// MARK: - APNs Transport

interface APNsPayload {
  deviceToken: string;
  title: string;
  body: string;
  category?: string;
  data?: Record<string, unknown>;
  badge?: number;
}

async function sendAPNs(payload: APNsPayload): Promise<void> {
  const keyBase64 = process.env.APNS_KEY_BASE64;
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const bundleId = process.env.APNS_BUNDLE_ID ?? "coach.tonal.app";
  const environment = process.env.APNS_ENVIRONMENT ?? "development";

  if (!keyBase64 || !keyId || !teamId) {
    throw new Error(
      "APNs not configured: set APNS_KEY_BASE64, APNS_KEY_ID, and APNS_TEAM_ID in Convex dashboard",
    );
  }

  const { SignJWT, importPKCS8 } = await import("jose");

  const pemKey = Buffer.from(keyBase64, "base64").toString("utf-8");
  const privateKey = await importPKCS8(pemKey, "ES256");

  const jwt = await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyId })
    .setIssuer(teamId)
    .setIssuedAt()
    .sign(privateKey);

  const host =
    environment === "production"
      ? "https://api.push.apple.com"
      : "https://api.sandbox.push.apple.com";

  const response = await fetch(`${host}/3/device/${payload.deviceToken}`, {
    method: "POST",
    headers: {
      authorization: `bearer ${jwt}`,
      "apns-topic": bundleId,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      aps: {
        alert: { title: payload.title, body: payload.body },
        sound: "default",
        badge: payload.badge ?? 0,
        ...(payload.category ? { category: payload.category } : {}),
      },
      ...(payload.data ?? {}),
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`APNs error ${response.status}: ${errorBody}`);
  }
}

// MARK: - Shared send logic

async function sendToUserTokens(
  tokens: Array<{ token: string }>,
  payload: {
    title: string;
    body: string;
    category?: string;
    data?: Record<string, string>;
    badge?: number;
  },
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  for (const { token } of tokens) {
    try {
      await sendAPNs({
        deviceToken: token,
        title: payload.title,
        body: payload.body,
        category: payload.category,
        data: payload.data,
        badge: payload.badge,
      });
      sent++;
    } catch {
      failed++;
    }
  }

  return { sent, failed };
}

// MARK: - Actions

/** Send a push notification to a specific user. */
export const sendToUser = internalAction({
  args: {
    userId: v.id("users"),
    title: v.string(),
    body: v.string(),
    category: v.optional(v.string()),
    data: v.optional(v.record(v.string(), v.string())),
    badge: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const tokens: Array<{ token: string; platform: string }> = await ctx.runQuery(
      internal.notifications.tokenQuery.getTokensForUser,
      { userId: args.userId },
    );

    if (tokens.length === 0) {
      return { sent: 0, failed: 0 };
    }

    return sendToUserTokens(tokens, args);
  },
});

/** Send a push notification to multiple users (e.g. weekly recap). */
export const sendToUsers = internalAction({
  args: {
    userIds: v.array(v.id("users")),
    title: v.string(),
    body: v.string(),
    category: v.optional(v.string()),
    data: v.optional(v.record(v.string(), v.string())),
  },
  handler: async (ctx, args) => {
    let totalSent = 0;
    let totalFailed = 0;

    for (const userId of args.userIds) {
      const tokens: Array<{ token: string; platform: string }> = await ctx.runQuery(
        internal.notifications.tokenQuery.getTokensForUser,
        { userId },
      );

      if (tokens.length === 0) continue;

      const result = await sendToUserTokens(tokens, args);
      totalSent += result.sent;
      totalFailed += result.failed;
    }

    return { sent: totalSent, failed: totalFailed };
  },
});
