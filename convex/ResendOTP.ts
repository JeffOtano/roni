import { Email } from "@convex-dev/auth/providers/Email";
import type { EmailConfig } from "@convex-dev/auth/server";
import { sendEmail } from "./email";

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
        subject: "Your tonal.coach verification code",
        html: verificationEmailHtml(token),
      });
    },
  });
}

function verificationEmailHtml(code: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
      <h1 style="font-size: 24px; font-weight: 700; color: #111; margin-bottom: 8px;">
        tonal.coach
      </h1>
      <p style="font-size: 16px; color: #555; margin-bottom: 32px;">
        Use this code to reset your password. It expires in 15 minutes.
      </p>
      <div style="background: #f4f4f5; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 32px;">
        <span style="font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #111;">
          ${code}
        </span>
      </div>
      <p style="font-size: 14px; color: #888;">
        If you did not request this code, you can safely ignore this email.
      </p>
    </div>
  `.trim();
}
