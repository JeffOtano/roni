import { v } from "convex/values";
import { action, internalMutation, internalQuery } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { sendEmail } from "./email";

const EMAIL_CHANGE_CODE_TTL_MS = 15 * 60 * 1000; // 15 minutes

export const requestEmailChange = action({
  args: { newEmail: v.string() },
  handler: async (ctx, { newEmail }): Promise<void> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const normalizedEmail = newEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      throw new Error("Invalid email address");
    }

    // Check current email isn't the same
    const currentUser = await ctx.runQuery(internal.account.getUserEmail, { userId });
    if (currentUser?.email === normalizedEmail) {
      throw new Error("New email is the same as your current email");
    }

    // Check new email isn't already in use (by another user)
    const emailTaken = await ctx.runQuery(internal.emailChange.isEmailTaken, {
      email: normalizedEmail,
      excludeUserId: userId,
    });
    if (emailTaken) {
      throw new Error("This email is already in use by another account");
    }

    // Generate 8-digit code and hash it for storage
    const code = generateNumericCode(8);
    const codeHash = await hashCode(code);

    // Invalidate any pending requests and create new one
    await ctx.runMutation(internal.emailChange.createRequest, {
      userId,
      newEmail: normalizedEmail,
      codeHash,
      expiresAt: Date.now() + EMAIL_CHANGE_CODE_TTL_MS,
    });

    // Send verification email to the NEW address
    await sendEmail({
      to: normalizedEmail,
      subject: "Verify your new email for tonal.coach",
      html: emailChangeHtml(code),
    });
  },
});

export const confirmEmailChange = action({
  args: { code: v.string() },
  handler: async (ctx, { code }): Promise<void> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Find the pending request
    const request = await ctx.runQuery(internal.emailChange.getPendingRequest, { userId });
    if (!request) {
      throw new Error("No pending email change request");
    }

    if (request.expiresAt < Date.now()) {
      throw new Error("Verification code has expired");
    }

    // Verify code
    const codeHash = await hashCode(code.trim());
    if (codeHash !== request.codeHash) {
      throw new Error("Invalid verification code");
    }

    // Re-check email availability (race condition guard)
    const emailTaken = await ctx.runQuery(internal.emailChange.isEmailTaken, {
      email: request.newEmail,
      excludeUserId: userId,
    });
    if (emailTaken) {
      throw new Error("This email is already in use by another account");
    }

    // Update user record, auth account providerAccountId, and mark request as used
    await ctx.runMutation(internal.emailChange.applyChange, {
      userId,
      requestId: request._id,
      newEmail: request.newEmail,
    });
  },
});

// --- Internal functions ---

export const isEmailTaken = internalQuery({
  args: { email: v.string(), excludeUserId: v.id("users") },
  handler: async (ctx, { email, excludeUserId }) => {
    const existingUser = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .first();
    return existingUser !== null && existingUser._id !== excludeUserId;
  },
});

export const createRequest = internalMutation({
  args: {
    userId: v.id("users"),
    newEmail: v.string(),
    codeHash: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, { userId, newEmail, codeHash, expiresAt }) => {
    // Delete existing pending requests for this user
    const existing = await ctx.db
      .query("emailChangeRequests")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    for (const req of existing) {
      if (req.usedAt === undefined) {
        await ctx.db.delete(req._id);
      }
    }

    return ctx.db.insert("emailChangeRequests", {
      userId,
      newEmail,
      codeHash,
      expiresAt,
    });
  },
});

export const getPendingRequest = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const requests = await ctx.db
      .query("emailChangeRequests")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
    // Return the most recent unused request
    return requests.find((r) => r.usedAt === undefined) ?? null;
  },
});

export const applyChange = internalMutation({
  args: {
    userId: v.id("users"),
    requestId: v.id("emailChangeRequests"),
    newEmail: v.string(),
  },
  handler: async (ctx, { userId, requestId, newEmail }) => {
    // Update the user's email
    await ctx.db.patch(userId, { email: newEmail });

    // Update the auth account's providerAccountId so login works with the new email
    const account = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", userId).eq("provider", "password"))
      .first();
    if (account) {
      await ctx.db.patch(account._id, { providerAccountId: newEmail });
    }

    // Mark request as used
    await ctx.db.patch(requestId, { usedAt: Date.now() });
  },
});

// --- Utility functions ---

export function generateNumericCode(length: number): string {
  const bytes = new Uint8Array(Math.ceil(length / 2) + 1);
  crypto.getRandomValues(bytes);
  let num = 0;
  for (let i = 0; i < bytes.length; i++) {
    num = (num * 256 + bytes[i]) >>> 0;
  }
  const mod = Math.pow(10, length);
  return String(num % mod).padStart(length, "0");
}

export async function hashCode(code: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(code);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function emailChangeHtml(code: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
      <h1 style="font-size: 24px; font-weight: 700; color: #111; margin-bottom: 8px;">
        tonal.coach
      </h1>
      <p style="font-size: 16px; color: #555; margin-bottom: 32px;">
        Enter this code to confirm your new email address. It expires in 15 minutes.
      </p>
      <div style="background: #f4f4f5; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 32px;">
        <span style="font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #111;">
          ${code}
        </span>
      </div>
      <p style="font-size: 14px; color: #888;">
        If you did not request this change, you can safely ignore this email.
      </p>
    </div>
  `.trim();
}
