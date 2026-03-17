import { Email } from "@convex-dev/auth/providers/Email";
import type { EmailConfig } from "@convex-dev/auth/server";
import { sendEmail } from "./email";
import { codeBlock, expiryBadge, finePrint, heading, paragraph, wrapEmail } from "./emailTemplates";

/**
 * Custom email provider that sends OTP verification codes via the Resend HTTP API.
 *
 * Used by the Password provider's `reset` option to send password-reset codes.
 * Tokens are 8-digit numeric codes (< 24 chars), so @convex-dev/auth automatically
 * requires the email to match on verification -- no extra authorize logic needed.
 */
export function ResendOTP(config: { id?: string; maxAge?: number } = {}): EmailConfig {
  return Email({
    id: config.id ?? "resend-otp",
    maxAge: config.maxAge ?? 15 * 60, // 15 minutes

    async generateVerificationToken() {
      const bytes = new Uint8Array(4);
      crypto.getRandomValues(bytes);
      // Convert to 8-digit zero-padded numeric code (00000000 - 99999999)
      const num = ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
      return String(num % 100_000_000).padStart(8, "0");
    },

    async sendVerificationRequest({ identifier: email, token }) {
      await sendEmail({
        to: email,
        subject: "Your verification code",
        html: verificationEmailHtml(token),
      });
    },
  });
}

function verificationEmailHtml(code: string): string {
  return wrapEmail(`
    ${heading("Here's your code")}
    ${paragraph("Enter this to reset your password. Don't share it with anyone.")}
    ${expiryBadge(15)}
    ${codeBlock(code)}
    ${finePrint("Didn't request this? Just ignore it — nothing will change.")}
  `);
}
