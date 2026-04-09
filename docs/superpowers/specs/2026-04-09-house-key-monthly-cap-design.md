# House-Key Monthly Cap

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Prevent unbounded Gemini API cost from grandfathered house-key users by enforcing a 500 messages/month hard cap, with a clear BYOK upgrade path when the cap is hit.

**Architecture:** Single enforcement point in `resolveUserGeminiKey` (the chokepoint every AI call passes through), routed through an internal mutation for rate-limiter context. New error code `house_key_quota_exhausted` flows through the existing BYOK error pipeline to an amber-styled banner on the frontend.

**Tech Stack:** `@convex-dev/rate-limiter` (fixed window), existing BYOK error pipeline (`classifyByokError` / `parseByokError` / `FailureBanner`).

---

## Rate limit definition

Add `houseKeyMonthly` to `convex/rateLimits.ts` as a fixed-window limit:

- Rate: 500 messages per 30-day window
- Keyed by userId at call time
- Export `HOUSE_KEY_MONTHLY_LIMIT = 500` as a named constant so the frontend can reference the number in copy

## Enforcement point

`resolveUserGeminiKey` in `convex/chat.ts` is the single function every AI path calls to resolve which Gemini key to use. It runs in action context.

After `resolveGeminiKey` returns the house key for a grandfathered user, check the monthly cap:

1. Determine if the user is grandfathered: `!isBYOKRequired(context.userCreationTime)`
2. Confirm the kill switch is NOT active: `process.env.BYOK_DISABLED !== "true"` (when the kill switch is on, everyone uses the house key for emergency reasons -- don't cap them)
3. If both conditions hold, consume from `houseKeyMonthly` via an internal mutation (`convex/byok._checkHouseKeyQuota`)
4. If the rate limiter throws, catch and reclassify as `throw new Error("house_key_quota_exhausted")`

The internal mutation is needed because the rate limiter requires mutation context, but `resolveUserGeminiKey` runs in action context. Pattern: `ctx.runMutation(internal.byok._checkHouseKeyQuota, { userId })`.

### `_checkHouseKeyQuota` (internal mutation, `convex/byok.ts`)

```ts
export const _checkHouseKeyQuota = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await rateLimiter.limit(ctx, "houseKeyMonthly", { key: userId, throws: true });
  },
});
```

## Error pipeline

The error code `house_key_quota_exhausted` is thrown as `new Error("house_key_quota_exhausted")` from `resolveUserGeminiKey`, before Gemini is ever called. It does NOT need to be added to `classifyByokError` in `convex/ai/resilience.ts` because that function only classifies errors that come back from the Gemini API. Our error originates before the API call.

The code propagates through `withByokErrorSanitization` unchanged (the catch only reclassifies Gemini-pattern errors, passes everything else through).

### Client-side changes

**`src/components/byok/parseByokError.ts`:** Add `"house_key_quota_exhausted"` to the `BYOK_ERROR_CODES` array. The existing `parseByokError` function will match it in the error message string, and `ChatInput` will render `FailureBanner` with no changes to `ChatInput.tsx` itself.

**`src/components/byok/FailureBanner.tsx`:**

1. Add `"house_key_quota_exhausted"` to the `FailureReason` union type
2. Add the message to the `MESSAGES` record: "You've used your 500 free AI messages this month. Add your own Gemini key to keep going -- it's free from Google."
3. Render with `variant="default"` (amber/info tone) instead of `variant="destructive"` (red) when reason is `house_key_quota_exhausted`. Hitting a quota boundary is not an error.
4. Link text: "Add your key" instead of "Fix it". Same destination: `/settings#gemini-key`.

## What this affects

- Grandfathered users (created before `BYOK_REQUIRED_AFTER`) on the house key: capped at 500 AI messages per 30-day fixed window (resets every 30 days from first use, not a rolling count)
- BYOK users: completely unaffected (they never enter the `isGrandfathered` branch)
- Kill-switch path (`BYOK_DISABLED=true`): uncapped (emergency mode, not normal operation)
- Non-AI operations (viewing schedule, stats, exercises, settings): unaffected

## Testing

### Unit tests

- `convex/byok.test.ts`: Test `_checkHouseKeyQuota` -- verify it calls `rateLimiter.limit` with the correct parameters. Test that it throws when the limit is exceeded.
- `src/components/byok/parseByokError.test.ts`: Add one test -- `parseByokError(new Error("house_key_quota_exhausted"))` returns `"house_key_quota_exhausted"`.
- `src/components/byok/FailureBanner.test.tsx`: If a test file exists, add a render test confirming the amber styling and "Add your key" link text for the new reason.

### Manual smoke test

After deploy, log in as a grandfathered user. Send a message -- confirm no error. Temporarily set `HOUSE_KEY_MONTHLY_LIMIT` to 1, deploy, send two messages -- confirm the amber banner appears with correct copy and "Add your key" routes to settings. Reset the limit to 500 and redeploy.

## Out of scope

- **Soft warning at 80% usage.** Proactive check-in at ~400 messages would be good UX. Follow-up, not v1.
- **Usage counter visible to the user.** No "237 of 500 messages used" display. The user learns about the limit only when hitting it.
- **Per-conversation grace period.** If the user hits 500 mid-conversation, the next message fails. No "finish this thread" exemption.
- **Admin per-user override.** No mechanism to bump a specific user's quota. Adjust `HOUSE_KEY_MONTHLY_LIMIT` globally if needed.
