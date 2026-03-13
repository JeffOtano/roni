# Progressive overload data source

## Per-exercise history

**Source:** Tonal APIs only (no Convex cache of set-level data by default).

- **Activities:** `GET /v6/users/{userId}/activities` → list of completed workouts with `activityId`, `activityTime`, `workoutPreview` (no set-level data).
- **Workout detail:** `GET /v6/users/{userId}/workout-activities/{activityId}` → `WorkoutActivityDetail` with `workoutSetActivity: SetActivity[]`. Each `SetActivity` has `movementId`, `prescribedReps`, `repetition`, `repetitionTotal`, `weightPercentage` (optional). **No absolute weight in lbs** in this response.
- **Formatted summary:** `GET /v6/formatted/users/{userId}/workout-summaries/{summaryId}` → `FormattedWorkoutSummary` with `movementSets[].totalVolume` per movement. If `summaryId` equals `activityId` (or is derivable), we can compute **avg weight = totalVolume / totalReps** using reps from workout detail.

## Set-level weight

- **Today:** We derive sets and reps from `WorkoutActivityDetail.workoutSetActivity` (group by `movementId`). Average weight (lbs) is available only when we have per-movement volume (e.g. from `FormattedWorkoutSummary` when the API accepts `activityId` as `summaryId`).
- **If formatted summary is not available:** Document "Last time: 4×10" (sets×reps) and omit weight, or show weight as "—" until we have volume. Optional: cache `totalVolume` per movement per activity in Convex after each fetch (minimal schema: e.g. `exerciseHistoryCache` with `userId`, `activityId`, `movementId`, `totalVolume`, `totalReps`, `sessionDate`).

## API call volume and cost

**Current behavior:** `getPerMovementHistory` (and thus `getLastTimeAndSuggested`) fetches the activity list, then for each activity calls `fetchWorkoutDetail` and optionally `fetchFormattedSummary`. With default `maxActivities: 20`, that’s **1 + 20 + up to 20 ≈ 41 Tonal API calls** per user per invocation. At scale this can hit rate limits and add latency.

**Recommendations:** (1) Lower the default `maxActivities` (e.g. 10) if you don’t need 20 activities for "last time" display. (2) Add a Convex cache (e.g. `tonalCache` with `dataType: "perMovementHistory"` and TTL 1–6 hours) keyed by `userId`, and refresh on a schedule or when the user completes a workout. (3) Monitor Tonal proxy errors and latency so you can add caching or back off if needed.

## Minimal cache (optional)

If we want to avoid re-fetching workout details for "last time" on every load:

- **Table:** `exerciseHistoryCache` (or store under existing `tonalCache` with `dataType: "perMovementHistory"`).
- **Shape:** One blob per user: `{ movementId → Array<{ sessionDate, sets, totalReps, avgWeightLbs? }> }`, updated when we fetch workout history/detail (e.g. same TTL as workout history).
- **Scope:** This workstream uses existing Tonal data only; caching is optional and can be added later.
