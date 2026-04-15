/**
 * Returns true unless DISABLE_CRONS=true is set.
 * Use this to silence cron jobs on dev deployments without
 * requiring any env vars on production or self-hosted instances.
 */
export function cronsEnabled(): boolean {
  return process.env.DISABLE_CRONS !== "true";
}
