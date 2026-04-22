/**
 * Garmin Push webhook signature verification.
 *
 * Garmin signs each Push payload with the partner's consumer secret.
 * The exact header name + algorithm are documented in the Activity API
 * and Health API partner PDFs, which are not yet in this tree.
 *
 * Behavior until the real algorithm lands:
 *   - Prod (no skip env var): every webhook is rejected with 401. We
 *     never process unverified payloads in environments handling real
 *     user data. Production will stay silent on Garmin Push until
 *     `implementVerification` is real.
 *   - Dev with `GARMIN_WEBHOOK_SIGNATURE_VERIFY=skip`: accepts the
 *     payload so the dispatch pipeline can be exercised against a
 *     trusted local Garmin test workspace. The skip mode additionally
 *     requires `GARMIN_WEBHOOK_SKIP_ACKNOWLEDGED=yes-i-know-this-is-dev`
 *     so a forgotten env var on a promoted deployment can't silently
 *     disable verification.
 *
 * When the partner PDFs arrive, replace this with the real HMAC
 * comparison and delete the skip escape hatch entirely.
 */

export type SignatureCheckResult = { valid: true } | { valid: false; reason: string };

const SKIP_ACK_REQUIRED = "yes-i-know-this-is-dev";

export async function verifyGarminWebhookSignature(
  req: Request,
  _rawBody: string,
): Promise<SignatureCheckResult> {
  const mode = process.env.GARMIN_WEBHOOK_SIGNATURE_VERIFY;
  const skipAck = process.env.GARMIN_WEBHOOK_SKIP_ACKNOWLEDGED;

  if (mode === "skip" && skipAck === SKIP_ACK_REQUIRED) {
    return { valid: true };
  }

  if (mode === "skip") {
    return {
      valid: false,
      reason:
        "GARMIN_WEBHOOK_SIGNATURE_VERIFY=skip also requires GARMIN_WEBHOOK_SKIP_ACKNOWLEDGED=yes-i-know-this-is-dev",
    };
  }

  // The signature header name and algorithm are documented in the
  // Garmin Activity/Health API partner PDFs. Once received, implement:
  //   1. Read header (e.g. "X-Garmin-Signature" or similar).
  //   2. Compute HMAC-SHA256 (or documented algo) of rawBody using
  //      GARMIN_CONSUMER_SECRET.
  //   3. Constant-time compare against header.
  //
  // Referencing `req` so the param isn't flagged as unused.
  void req;

  return {
    valid: false,
    reason:
      "Garmin webhook signature verification not yet implemented. Payloads will be rejected until the Activity/Health API partner doc lands and real HMAC verification ships.",
  };
}
