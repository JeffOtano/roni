import { DAY, MINUTE, RateLimiter, SECOND } from "@convex-dev/rate-limiter";
import { components } from "./_generated/api";

/** Daily message cap per user. Easy to adjust per tier later. */
export const DAILY_MESSAGE_LIMIT = 30;

/**
 * Global cap on new account creation to blunt automated signup abuse. Well
 * above any realistic organic signup rate for a personal-scale hosted
 * instance and still blocks bulk bot floods.
 */
export const NEW_SIGNUP_RATE_PER_HOUR = 20;
export const NEW_SIGNUP_BURST_CAPACITY = 5;
const NEW_SIGNUP_PERIOD = 60 * MINUTE;

/** Monthly cap for grandfathered users running on the shared house key. */
export const HOUSE_KEY_MONTHLY_LIMIT = 500;
const HOUSE_KEY_MONTHLY_PERIOD = 30 * DAY;

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
  refreshTonalData: {
    kind: "token bucket",
    rate: 2,
    period: MINUTE,
    capacity: 2,
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
  newSignup: {
    kind: "token bucket",
    rate: NEW_SIGNUP_RATE_PER_HOUR,
    period: NEW_SIGNUP_PERIOD,
    capacity: NEW_SIGNUP_BURST_CAPACITY,
  },
  houseKeyMonthly: {
    kind: "fixed window",
    rate: HOUSE_KEY_MONTHLY_LIMIT,
    period: HOUSE_KEY_MONTHLY_PERIOD,
  },
});
