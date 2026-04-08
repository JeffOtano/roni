# Activation metric (North Star v2)

## Definitions

- **Signup:** User has connected their Tonal account to tonal.coach. Stored as a user profile with Tonal credentials; timestamp is `userProfiles.tonalConnectedAt` (set on first connection; may be undefined for profiles created before this field existed).
- **Activation:** User has completed their first AI-programmed workout on Tonal. Stored as `userProfiles.firstAiWorkoutCompletedAt`.

**AI-programmed workout:** A workout created via tonal.coach: a row in `workoutPlans` with our `userId` and optional `source: "tonal_coach"`. Only such workouts pushed to Tonal count toward activation.

**Completed:** The workout appears in the user’s Tonal workout history (activities from `/v6/users/{userId}/activities`). We match by `activity.workoutPreview.workoutId` equal to a pushed `workoutPlans.tonalWorkoutId` for that user.

## How the metric is computed

1. **Eligible users:** Profiles with no `firstAiWorkoutCompletedAt`. In practice, `userProfiles` are created when Tonal is connected, so this is the connected-user cohort.
2. **Pushed AI workouts:** For each user, we take `workoutPlans` with `userId`, `status === "pushed"`, and `source === "tonal_coach"` (or undefined for backward compatibility), and collect their `tonalWorkoutId`s.
3. **Tonal activities:** We fetch the user’s workout history via the existing Tonal proxy (`fetchWorkoutHistory`). We find activities whose `workoutPreview.workoutId` is in our set of pushed IDs.
4. **First completion:** The earliest such activity’s `activityTime` is written to `userProfiles.firstAiWorkoutCompletedAt` (only if that field is not already set).

A Convex cron (`check-activation`) runs hourly and calls `activation.runActivationCheckForEligibleUsers`, which runs `activation.checkActivation` for each eligible user (in batches with a short delay to respect Tonal rate limits).

## Where to query

- **Signup count / signup timestamp:** Query `userProfiles`; signups are rows with Tonal credentials. Use `tonalConnectedAt` for “time of signup” when present.
- **Activation count / activation timestamp:** Query `userProfiles.firstAiWorkoutCompletedAt`. Non-null means activated.
- **72-hour activation rate:** For a cohort of signups (e.g. by `tonalConnectedAt`), count how many have `firstAiWorkoutCompletedAt` within 72 hours of `tonalConnectedAt`. Target: 40%+ (see northstar spec). Minimum sample 50 signups before treating the rate as meaningful.

## Cohort and 72h rate

**Who counts:** "Signup" and "40% activated within 72 hours" apply to users who have `tonalConnectedAt` set. That field is set only when a user connects Tonal **after** the deployment that added it. Profiles created before that have `tonalConnectedAt === undefined` and are excluded from 72h activation rate (you cannot compute "72h since signup" without a signup timestamp).

**Backfill (optional):** If you need an approximate signup time for existing users, you can one-time backfill from another source (e.g. first `workoutPlans.createdAt` for that user, or `lastActiveAt`). Document the backfill so analysts know which cohort is which.

## Querying 72h activation rate

Use the internal Convex query `internal.activation.getActivationRate72h` to compute activation rate for a cohort.

- **Function:** `internal.activation.getActivationRate72h`
- **Args:** `{ days: number }` — cohort = signups in the last `days` days (profiles with `tonalConnectedAt >= now - days * 24h`).
- **Returns:** `{ total, activated, rate }` where `activated` = users in the cohort who have `firstAiWorkoutCompletedAt` set and `(firstAiWorkoutCompletedAt - tonalConnectedAt) <= 72 * 3600 * 1000` ms; `rate = total > 0 ? activated / total : 0`.

**How to run:** In the Convex dashboard, open your project, run the internal function `activation:getActivationRate72h`, set `days` (for example `7` or `14`), and inspect the result. This function is internal-only, so it is not callable from client app code via `api.activation`.

Target: 40%+ rate. Minimum sample 50 signups before treating the rate as meaningful.

All of this is in Convex; no dashboard or activation UI is included—only event definition and Convex logic.
