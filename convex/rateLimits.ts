import { DAY, MINUTE, RateLimiter, SECOND } from "@convex-dev/rate-limiter";
import { components } from "./_generated/api";

/** Daily message cap per user. Easy to adjust per tier later. */
export const DAILY_MESSAGE_LIMIT = 30;

export const rateLimiter = new RateLimiter(components.rateLimiter, {
  sendMessage: {
    kind: "token bucket",
    rate: 1,
    period: 5 * SECOND,
    capacity: 3,
  },
  dailyMessages: {
    kind: "fixed window",
    rate: DAILY_MESSAGE_LIMIT,
    period: DAY,
  },
  globalAICalls: {
    kind: "token bucket",
    rate: 60,
    period: MINUTE,
    capacity: 10,
  },
  mcpRequest: {
    kind: "token bucket",
    rate: 30,
    period: MINUTE,
    capacity: 10,
  },
  submitFeedback: {
    kind: "token bucket",
    rate: 5,
    period: MINUTE,
    capacity: 3,
  },
  createGoal: {
    kind: "token bucket",
    rate: 5,
    period: MINUTE,
    capacity: 3,
  },
  reportInjury: {
    kind: "token bucket",
    rate: 5,
    period: MINUTE,
    capacity: 3,
  },
  createTonalWorkout: {
    kind: "token bucket",
    rate: 3,
    period: MINUTE,
    capacity: 5,
  },
  imageUpload: {
    kind: "token bucket",
    rate: 10,
    period: MINUTE,
    capacity: 15,
  },
  programWeek: {
    kind: "token bucket",
    rate: 2,
    period: MINUTE,
    capacity: 3,
  },
  validateGeminiKey: {
    kind: "token bucket",
    rate: 5,
    period: MINUTE,
    capacity: 3,
  },
  /**
   * Global cap on new account creation to blunt automated signup abuse.
   * 20/hour is well above any realistic organic signup rate for a
   * personal-scale hosted instance and still blocks bulk bot floods.
   */
  newSignup: {
    kind: "token bucket",
    rate: 20,
    period: 60 * MINUTE,
    capacity: 5,
  },
});
