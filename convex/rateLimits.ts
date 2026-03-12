import { RateLimiter, MINUTE, SECOND } from "@convex-dev/rate-limiter";
import { components } from "./_generated/api";

export const rateLimiter = new RateLimiter(components.rateLimiter, {
  sendMessage: {
    kind: "token bucket",
    rate: 1,
    period: 5 * SECOND,
    capacity: 3,
  },
  globalAICalls: {
    kind: "token bucket",
    rate: 60,
    period: MINUTE,
    capacity: 10,
  },
});
