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

export default crons;
