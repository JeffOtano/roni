/**
 * Shared email template system.
 *
 * All emails pass through `wrapEmail` for consistent branding.
 * Colors are hex approximations of the app's OKLCH design tokens.
 * Font stack mirrors the app (DM Sans primary, system fallbacks).
 */

const BRAND = {
  /** oklch(0.52 0.14 195) */
  primary: "#0d7e8c",
  /** oklch(0.985 0.002 265) */
  background: "#f8f9fc",
  /** oklch(0.155 0.015 265) */
  foreground: "#1a1c2e",
  /** oklch(0.48 0.012 265) */
  muted: "#6b7085",
  /** oklch(0.955 0.008 265) */
  surface: "#f0f2f5",
  /** oklch(0.905 0.008 265) */
  border: "#e2e5eb",
  card: "#ffffff",
  fontStack: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
} as const;

/** Wrap email body content in the branded layout chrome. */
export function wrapEmail(body: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>tonal.coach</title>
</head>
<body style="margin: 0; padding: 0; background: ${BRAND.background}; font-family: ${BRAND.fontStack}; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: ${BRAND.background};">
    <tr>
      <td align="center" style="padding: 48px 16px 32px;">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width: 480px; width: 100%;">

          <!-- Header -->
          <tr>
            <td style="padding-bottom: 32px;">
              <span style="font-size: 20px; font-weight: 700; color: ${BRAND.primary}; letter-spacing: -0.3px;">
                tonal.coach
              </span>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background: ${BRAND.card}; border-radius: 12px; border: 1px solid ${BRAND.border}; padding: 36px 32px;">
              ${body}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top: 28px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: ${BRAND.muted}; line-height: 1.5;">
                tonal.coach &mdash; your AI strength coach
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

/** Large code block for OTP / verification codes. */
export function codeBlock(code: string): string {
  return `
<div style="background: ${BRAND.surface}; border-radius: 10px; padding: 20px; text-align: center; margin: 24px 0;">
  <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: ${BRAND.foreground}; font-family: 'DM Sans', monospace;">
    ${code}
  </span>
</div>`.trim();
}

/** Styled heading for email body. */
export function heading(text: string): string {
  return `<h1 style="margin: 0 0 12px; font-size: 22px; font-weight: 700; color: ${BRAND.foreground}; line-height: 1.3;">${text}</h1>`;
}

/** Body paragraph. */
export function paragraph(text: string): string {
  return `<p style="margin: 0 0 16px; font-size: 15px; color: ${BRAND.muted}; line-height: 1.6;">${text}</p>`;
}

/** Fine print / disclaimer text. */
export function finePrint(text: string): string {
  return `<p style="margin: 16px 0 0; font-size: 13px; color: ${BRAND.muted}; line-height: 1.5; opacity: 0.7;">${text}</p>`;
}

/** Expiry badge — small, pill-shaped timing context. */
export function expiryBadge(minutes: number): string {
  return `
<div style="text-align: center; margin-bottom: 8px;">
  <span style="display: inline-block; background: ${BRAND.surface}; color: ${BRAND.muted}; font-size: 12px; font-weight: 600; padding: 4px 12px; border-radius: 99px;">
    Expires in ${minutes} minutes
  </span>
</div>`.trim();
}
