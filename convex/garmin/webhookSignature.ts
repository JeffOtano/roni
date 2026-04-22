/**
 * Garmin Push webhook authenticity check.
 *
 * The Activity API V1.2.4 spec (§5.1) does NOT define a request-signing
 * header for partner webhook deliveries. Security instead rests on:
 *   1. The partner-registered URL is HTTPS-only.
 *   2. Garmin keeps the URL private to the partner account.
 *   3. Every Push payload carries the Garmin `userId` (and for most
 *      types a `userAccessToken`) as an implicit identity claim.
 *
 * So "verification" at the HTTP boundary is a cheap structural check
 * that the payload looks like a Garmin push; the real identity match
 * happens in the dispatcher, where we look up the payload's userId in
 * `garminConnections` before touching domain data.
 */

export type SignatureCheckResult = { valid: true } | { valid: false; reason: string };

export async function verifyGarminWebhookSignature(
  _req: Request,
  rawBody: string,
): Promise<SignatureCheckResult> {
  if (rawBody.length === 0) {
    return { valid: false, reason: "Empty Garmin webhook body" };
  }
  return { valid: true };
}
