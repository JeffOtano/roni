import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
import { cronsEnabled } from "./lib/env";

const crons = cronJobs();

// DISABLE_CRONS=true silences all cron jobs (e.g. on dev deployments).
// Crons run by default -- no env var needed for prod or self-hosted.
if (cronsEnabled()) {
  crons.interval(
    "refresh-tonal-tokens",
    { minutes: 30 },
    internal.tonal.tokenRefresh.refreshExpiringTokens,
  );

  crons.interval(
    "refresh-tonal-cache",
    { hours: 1 },
    internal.tonal.cacheRefresh.refreshActiveUsers,
  );

  crons.interval(
    "check-activation",
    { hours: 1 },
    internal.activation.runActivationCheckForEligibleUsers,
  );

  crons.interval("check-in-triggers", { hours: 6 }, internal.checkIns.runCheckInTriggerEvaluation);

  crons.cron(
    "sync-movement-catalog",
    "0 3 * * *",
    internal.tonal.movementSync.startSyncMovementCatalog,
    {},
  );

  crons.cron(
    "sync-workout-catalog",
    "0 4 * * 0",
    internal.tonal.workoutCatalogSync.startSyncWorkoutCatalog,
    {},
  );

  crons.interval("health-check", { hours: 1 }, internal.healthCheck.runHealthCheck);

  crons.interval("vacuum-unused-files", { hours: 6 }, internal.fileGc.vacuumUnusedFiles);

  crons.cron("data-retention", "0 2 * * *", internal.dataRetention.runDataRetention, {});

  // Sunday 06:00 UTC keeps clear of the 03:00 / 04:00 catalog syncs.
  crons.cron("data-retention-cache", "0 6 * * 0", internal.dataRetention.runCacheRetention, {});

  crons.interval(
    "sweep-garmin-oauth-states",
    { hours: 1 },
    internal.garmin.connections.sweepExpiredOauthStates,
  );

  crons.interval(
    "sweep-garmin-webhook-events",
    { hours: 6 },
    internal.garmin.webhookEvents.sweepExpired,
  );
}

export default crons;
