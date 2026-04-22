/**
 * Garmin Push webhook signature verification.
 *
 * Garmin signs each Push payload with the partner's consumer secret.
 * The exact header name + algorithm are documented in the Activity API
 * and Health API partner PDFs, which are not yet in this tree.
 *
 * Until those land, this module fails closed in production: an empty
 * `GARMIN_WEBHOOK_SIGNATURE_VERIFY` env var causes every incoming Push
 * to be rejected. Set `GARMIN_WEBHOOK_SIGNATURE_VERIFY=skip` only on
 * local dev Convex deployments where you trust the webhook source.
 *
 * When the PDFs arrive, replace `verifyGarminWebhookSignature` with the
 * real HMAC comparison and remove the `skip` escape hatch.
 */

export type SignatureCheckResult = { valid: true } | { valid: false; reason: string };

export async function verifyGarminWebhookSignature(
  req: Request,
  _rawBody: string,
): Promise<SignatureCheckResult> {
  const mode = process.env.GARMIN_WEBHOOK_SIGNATURE_VERIFY;

  if (mode === "skip") {
    return { valid: true };
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
      "Garmin webhook signature verification not yet implemented; set GARMIN_WEBHOOK_SIGNATURE_VERIFY=skip in dev.",
  };
}
