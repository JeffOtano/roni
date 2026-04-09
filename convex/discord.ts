/**
 * Discord webhook notifications for key events.
 * Posts to a single channel with different embed colors per event type.
 */

import { internalAction } from "./_generated/server";
import { v } from "convex/values";

function getWebhookUrl(): string | undefined {
  return process.env.DISCORD_WEBHOOK_URL;
}

const COLORS = {
  signup: 0x00cacb, // teal — new signup
  connection: 0x22c55e, // green — tonal connected
  error: 0xef4444, // red — error
};

async function postToDiscord(embed: {
  title: string;
  description: string;
  color: number;
  fields?: { name: string; value: string; inline?: boolean }[];
}) {
  const url = getWebhookUrl();
  if (!url) return;

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [{ ...embed, timestamp: new Date().toISOString() }],
      }),
    });
  } catch {
    // Discord notifications are best-effort — never block the main flow
  }
}

export const notifySignup = internalAction({
  args: { email: v.string() },
  handler: async (_ctx, { email }) => {
    await postToDiscord({
      title: "New Signup",
      description: `**${email}** created an account`,
      color: COLORS.signup,
    });
  },
});

export const notifyTonalConnection = internalAction({
  args: { email: v.string(), tonalName: v.string() },
  handler: async (_ctx, { email, tonalName }) => {
    await postToDiscord({
      title: "Tonal Connected",
      description: `**${tonalName}** (${email}) linked their Tonal account`,
      color: COLORS.connection,
    });
  },
});

export const notifyError = internalAction({
  args: {
    source: v.string(),
    message: v.string(),
    userId: v.optional(v.string()),
  },
  handler: async (_ctx, { source, message, userId }) => {
    await postToDiscord({
      title: "Error",
      description: message.slice(0, 2000),
      color: COLORS.error,
      fields: [
        { name: "Source", value: source, inline: true },
        ...(userId ? [{ name: "User", value: userId, inline: true }] : []),
      ],
    });
  },
});
