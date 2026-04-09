import { v } from "convex/values";
import { action } from "./_generated/server";

/** Send a contact form message to the Discord #contact channel via webhook. */
export const send = action({
  args: {
    name: v.string(),
    email: v.string(),
    message: v.string(),
  },
  handler: async (_ctx, { name, email, message }) => {
    const webhookUrl = process.env.DISCORD_CONTACT_WEBHOOK;
    if (!webhookUrl) {
      throw new Error("Contact form is not configured for this deployment");
    }

    const embed = {
      title: "New Contact Form Message",
      color: 0x00cacb,
      fields: [
        { name: "Name", value: name, inline: true },
        { name: "Email", value: email, inline: true },
        { name: "Message", value: message },
      ],
      timestamp: new Date().toISOString(),
    };

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed] }),
    });

    if (!res.ok) {
      throw new Error(`Discord webhook failed: ${res.status}`);
    }
  },
});
