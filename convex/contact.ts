import { v } from "convex/values";
import { action } from "./_generated/server";
import { rateLimiter } from "./rateLimits";

const MAX_NAME_LENGTH = 100;
const MAX_EMAIL_LENGTH = 254;
const MAX_MESSAGE_LENGTH = 4000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Strip Discord mention syntax so the webhook can't @-flood the channel. */
export function sanitizeForDiscord(input: string): string {
  return input.replace(/@(everyone|here)/gi, "@\u200b$1");
}

/** Send a contact form message to the Discord #contact channel via webhook. */
export const send = action({
  args: {
    name: v.string(),
    email: v.string(),
    message: v.string(),
  },
  handler: async (ctx, { name, email, message }) => {
    const webhookUrl = process.env.DISCORD_CONTACT_WEBHOOK;
    if (!webhookUrl) {
      throw new Error("Contact form is not configured for this deployment");
    }

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedMessage = message.trim();

    if (!trimmedName || trimmedName.length > MAX_NAME_LENGTH) {
      throw new Error("Name is required and must be 100 characters or fewer");
    }
    if (
      !trimmedEmail ||
      trimmedEmail.length > MAX_EMAIL_LENGTH ||
      !EMAIL_PATTERN.test(trimmedEmail)
    ) {
      throw new Error("A valid email address is required");
    }
    if (!trimmedMessage || trimmedMessage.length > MAX_MESSAGE_LENGTH) {
      throw new Error("Message is required and must be 4000 characters or fewer");
    }

    // Single global bucket — there is no authenticated user or trusted IP
    // to key on. Caps total form submissions across all clients.
    await rateLimiter.limit(ctx, "contactForm", { throws: true });

    const embed = {
      title: "New Contact Form Message",
      color: 0x00cacb,
      fields: [
        { name: "Name", value: sanitizeForDiscord(trimmedName), inline: true },
        { name: "Email", value: sanitizeForDiscord(trimmedEmail), inline: true },
        { name: "Message", value: sanitizeForDiscord(trimmedMessage) },
      ],
      timestamp: new Date().toISOString(),
    };

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed], allowed_mentions: { parse: [] } }),
    });

    if (!res.ok) {
      throw new Error(`Discord webhook failed: ${res.status}`);
    }
  },
});
