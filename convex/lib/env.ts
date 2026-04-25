/**
 * Returns true unless DISABLE_CRONS=true is set.
 * Use this to silence cron jobs on dev deployments without
 * requiring any env vars on production or self-hosted instances.
 */
export function cronsEnabled(): boolean {
  return process.env.DISABLE_CRONS !== "true";
}

const PROD_PREVIEW_MAX_CHARS = 1024;
const DEV_PREVIEW_MAX_CHARS = 4096;

/**
 * Maximum char count retained in `aiToolCalls.argsJson` and `aiToolCalls.resultPreview`.
 *
 * Phoenix Cloud is the canonical raw-trace destination; the Convex column is a
 * bounded preview kept smaller in prod to cap row size.
 *
 * Resolution order:
 *  1. AI_TOOL_PREVIEW_MAX_CHARS env var (positive integer)
 *  2. VERCEL_ENV === "production" → 1024
 *  3. otherwise → 4096
 */
export function aiToolPreviewMaxChars(): number {
  const raw = process.env.AI_TOOL_PREVIEW_MAX_CHARS;
  if (raw !== undefined) {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return process.env.VERCEL_ENV === "production" ? PROD_PREVIEW_MAX_CHARS : DEV_PREVIEW_MAX_CHARS;
}
