import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "refresh-tonal-tokens",
  { minutes: 30 },
  internal.tonal.tokenRefresh.refreshExpiringTokens,
);

crons.interval(
  "refresh-tonal-cache",
  { minutes: 30 },
  internal.tonal.cacheRefresh.refreshActiveUsers,
);

crons.interval(
  "check-activation",
  { hours: 1 },
  internal.activation.runActivationCheckForEligibleUsers,
);

crons.interval("stuck-push-recovery", { minutes: 15 }, internal.workoutPlans.runStuckPushRecovery);

crons.interval("check-in-triggers", { hours: 6 }, internal.checkIns.runCheckInTriggerEvaluation);

crons.interval(
  "cleanup-oauth-states",
  { hours: 1 },
  internal.calendarOAuth.cleanupExpiredOAuthStates,
);

export default crons;
