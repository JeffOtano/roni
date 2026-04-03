# Schedule Resilience & Push Error Handling

**Date:** 2026-04-03
**Status:** Approved
**Context:** Beta user feedback -- schedule page fails to load after workout completion; 500 errors on workout push when exercise weight exceeds Tonal hardware limits.

## Problem

Two related issues surfaced from beta testers:

1. **Schedule page fails entirely when Tonal activity sync fails.** The `getWeekPlanEnriched` action fetches recent Tonal activities to mark workouts as completed. If that API call fails (token refresh timing, rate limit, transient 500), the entire schedule page shows an error. Users cannot view their week plan at all.

2. **Workout push returns 500 with no actionable feedback.** When an exercise exceeds Tonal's hardware limits (e.g., Frog Press has a 10 lb max but the user's calibrated weight is higher), Tonal returns a 500. The error is logged but the coach receives a generic failure message and cannot help the user resolve it.

## Fix 1: Schedule Resilience

### Change

In `convex/weekPlanEnriched.ts`, wrap the `fetchWorkoutHistory` call (line 155) in a try/catch. On failure:

- Set `activities` to an empty array
- Log the error with `console.error`
- Notify Discord via `discord.notifyError`
- Continue with the rest of the enrichment pipeline

### Behavior

- Schedule renders normally with all workout details (titles, exercises, durations)
- Completion status defaults to "programmed" for pushed workouts when sync fails
- Next successful refresh (5-min auto or manual) updates completion statuses
- No UI changes or staleness indicators

### Files Modified

- `convex/weekPlanEnriched.ts` -- try/catch around activity fetch

## Fix 2: Push Error Handling

### Changes

**A. `convex/tonal/mutations.ts` -- `doTonalCreateWorkout`**

When Tonal returns a 500 after retries, enhance the error message to include:

- Workout title
- List of movement IDs in the payload
- The original Tonal error status/message

This gives the coach agent enough context to identify which exercise may be problematic.

**B. `convex/coach/pushAndVerify.ts` -- `pushOneWorkout` / result handling**

When a push fails, ensure the error result includes:

- Day name and session type
- Workout title
- The enhanced error from `doTonalCreateWorkout`

This is already partially done (the `PushResult` type has `error` and `title` fields). The improvement is in the quality of the error message flowing through.

**C. `convex/ai/promptSections.ts` -- Coach push failure guidance**

Add a coaching instruction for handling push failures:

- When a 500 occurs, tell the user which specific workout/day failed
- Suggest the exercise that may be causing the issue (based on error context)
- Offer to swap the problematic exercise or adjust the workout
- Offer to retry the push after making changes

### What This Does NOT Do

- Does not validate absolute weights before push (no weight limit data available)
- Does not change progressive overload target calculations
- Does not fetch weight limits from Tonal's API (future work if available)

### Files Modified

- `convex/tonal/mutations.ts` -- enhanced error messages in `doTonalCreateWorkout`
- `convex/coach/pushAndVerify.ts` -- error context in push results
- `convex/ai/promptSections.ts` -- coach guidance for push failures

## Testing

- **Schedule resilience:** Unit test that `getWeekPlanEnriched` returns valid data when `fetchWorkoutHistory` throws
- **Push errors:** Unit test that `doTonalCreateWorkout` error messages include movement IDs and title context
- Existing tests must continue to pass

## Success Criteria

1. Schedule page loads successfully even when Tonal API is unavailable
2. When a workout push fails, the coach can identify and communicate which workout/exercise failed
3. No regressions in existing schedule or push functionality
