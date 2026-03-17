# External Activities Integration Design

## Problem

The Tonal API returns external activities (Apple Watch, HealthKit, Garmin Connect) via the `/v6/users/{id}/activities` endpoint with `activityType: "External"`. These include workouts like pickleball, walking, hiking, and non-Tonal strength training. The app currently filters these out entirely — `isTonalWorkout` drops anything with zero volume, and the AI training snapshot renders external activities as blank entries.

A dedicated endpoint (`GET /v6/users/{id}/external-activities`) provides richer data including calories, average heart rate, distance, and precise timestamps — none of which are available on the regular activities list.

This is valuable data the AI coach should use for recovery-aware programming, and users should see in their dashboard.

## Goals

1. **AI coach training load awareness** — The coach knows about recent external activities and factors their duration, type, and intensity into programming decisions (recovery-aware, approach B).
2. **Dashboard visibility** — Users see all activities in a unified view, with external activities in a separate "Other Activities" section below Tonal workouts.
3. **Clean data separation** — External activities use their own type and endpoint, not shoehorned into Tonal workout types.

## Non-Goals

- Automated week plan modification based on external activity (too imprecise without muscle group mapping)
- Muscle group inference engine for external activity types (the LLM reasons about this naturally)
- Aggregate stats for external activities (future scope)
- Click-through detail view for external activities (no set-level data available)
- Filtering/sorting/pagination for external activities on the dashboard

## API Discovery

### Regular activities endpoint

`GET /v6/users/{id}/activities` returns both `Internal` and `External` activities. External entries have two extra fields on `workoutPreview`:

- `source`: `"Apple Watch"` | `"Health"` | `"Connect"`
- `externalWorkoutType`: `"pickleball"` | `"walking"` | `"hiking"` | `"traditionalStrengthTraining"`

External entries have `totalVolume: 0`, `totalWork: 0`, empty `workoutTitle`, and a nil `workoutId` (`00000000-0000-0000-0000-000000000000`).

### Dedicated external activities endpoint

`GET /v6/users/{id}/external-activities` returns richer data:

| Field                              | Type   | Example                         | Coach Value                          |
| ---------------------------------- | ------ | ------------------------------- | ------------------------------------ |
| `workoutType`                      | string | `"pickleball"`                  | Infer muscle groups taxed            |
| `activeCalories`                   | number | `0` (always 0 in observed data) | Reserved by API, not useful yet      |
| `totalCalories`                    | number | `1180.69`                       | Metabolic load / recovery demand     |
| `averageHeartRate`                 | number | `139.6` bpm                     | Intensity signal (casual vs intense) |
| `distance`                         | number | `1.44` miles                    | Cardio load context                  |
| `beginTime` / `endTime`            | string | ISO 8601                        | Exact duration + time of day         |
| `timezone`                         | string | `"America/Denver"`              | Time-of-day context                  |
| `activeDuration` / `totalDuration` | number | seconds                         | Precise duration                     |
| `source`                           | string | `"Apple Watch"`                 | Data provenance                      |
| `externalId`                       | string | UUID                            | Original device-side ID              |
| `deviceId`                         | string | UUID                            | Device identifier                    |

Workout types observed: `pickleball`, `walking`, `hiking`, `traditionalStrengthTraining`.
Sources observed: `Apple Watch`, `Health`, `Connect`.

The workout detail endpoint (`/v6/users/{id}/workout-activities/{activityId}`) returns 404 for external activities — no set-level data exists.

## Design

### 1. Data Layer

**New type** in `convex/tonal/types.ts`:

```ts
export interface ExternalActivity {
  id: string;
  userId: string;
  workoutType: string;
  beginTime: string;
  endTime: string;
  timezone: string;
  activeDuration: number; // seconds
  totalDuration: number; // seconds
  distance: number; // miles (0 for non-distance activities)
  activeCalories: number;
  totalCalories: number;
  averageHeartRate: number; // bpm (0 if unavailable)
  source: string; // "Apple Watch", "Health", "Connect"
  externalId: string;
  deviceId: string;
}
```

**Update `workoutPreview` in existing `Activity` type** — add two optional fields:

```ts
source?: string;
externalWorkoutType?: string;
```

This ensures the regular activities list captures these fields when present. Note: `workoutPreview` already contains an `activityType` field (line 103 of types.ts). The top-level `Activity.activityType` is the authoritative field for External/Internal distinction. The nested `workoutPreview.activityType` is a duplicate provided by the API — both carry the same value, but code should always reference the top-level field.

**New proxy action** in `convex/tonal/proxy.ts`:

```ts
export const fetchExternalActivities = internalAction({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { userId, limit = 20 }) =>
    withTokenRetry(ctx, userId, (token, tonalUserId) =>
      cachedFetch<ExternalActivity[]>(ctx, {
        userId,
        dataType: `externalActivities:${limit}`,
        ttl: CACHE_TTLS.workoutHistory,
        fetcher: () =>
          tonalFetch<ExternalActivity[]>(
            token,
            `/v6/users/${tonalUserId}/external-activities?limit=${limit}`,
          ),
      }),
    ),
});
```

Uses the same `withTokenRetry` + `cachedFetch` pattern as all other proxy actions. Reuses `CACHE_TTLS.workoutHistory` (30 minutes) — no new cache key needed.

### 2. AI Coach Integration

**Training snapshot** (`convex/ai/context.ts`):

Add `fetchExternalActivities` to the parallel data fetch. Filter to last 7 days only. Render as:

```
External Activities (last 7 days):
  Mar 8 — Walking (Apple Watch) | 34min | 114 cal | Avg HR 96 (light)
  Mar 3 — Pickleball (Apple Watch) | 115min | 1181 cal | Avg HR 140 (vigorous)
  → Recent external load includes high-intensity activity. Factor into recovery and programming decisions.
```

HR intensity labels:

- Light: < 100 bpm
- Moderate: 100-130 bpm
- Vigorous: > 130 bpm
- Omitted if `averageHeartRate === 0`

Duration displayed in minutes (rounded). Calories rounded to nearest integer.

**System prompt** (`convex/ai/coach.ts`) — add to existing coaching instructions:

> When external activities (Apple Watch, HealthKit) appear in the training snapshot, factor their recency, duration, and intensity into your recovery estimates and programming decisions. High-intensity external sessions (vigorous HR, long duration) within the past 48 hours should influence exercise selection and volume.

No new tools. The context is passive — the coach reads it like muscle readiness or strength scores.

**Rendering priority:** The external activities section renders after recent Tonal workouts (current priority 9) and before performance notes. Priority order in the snapshot becomes: ...recent workouts → external activities → performance notes → missed session detection.

### 3. Dashboard

**New public action** in `convex/dashboard.ts`:

```ts
export const getExternalActivities = action({
  args: {},
  handler: async (ctx): Promise<ExternalActivity[]> => {
    const userId = await ctx.runQuery(internal.lib.auth.resolveEffectiveUserId, {});
    if (!userId) throw new Error("Not authenticated");
    return ctx.runAction(internal.tonal.proxy.fetchExternalActivities, {
      userId,
      limit: 10,
    });
  },
});
```

**New UI component** — "Other Activities" section below Tonal workout history:

- Section header: "Other Activities"
- Each entry: workout type (capitalized), date, duration, calories (if > 0), avg HR (if > 0)
- Lighter styling than Tonal workouts — no volume/work metrics
- Source badge (e.g., "Apple Watch")
- Simple reverse-chronological list, no click-through detail view
- Last 10 entries, no pagination

**Update `isTonalWorkout`** in `convex/dashboard.ts`:

```ts
export function isTonalWorkout(a: Activity): boolean {
  const wp = a.workoutPreview;
  if (!wp) return false;
  return a.activityType !== "External" && wp.totalVolume > 0;
}
```

Checks the type flag first (semantic), keeps the volume check as fallback.

### 4. Stats & Missed Session Detection

**No changes to stats.** `computeProgressMetrics` already only processes activities that pass through `isTonalWorkout`. External activities have no meaningful volume/work data.

**No changes to missed session detection.** This system compares Tonal workout IDs against the week plan. External activities are a different concern (general fatigue, not plan adherence). The coach handles fatigue reasoning via the training snapshot.

## File Changes

| File                    | Change                                                                                    |
| ----------------------- | ----------------------------------------------------------------------------------------- |
| `convex/tonal/types.ts` | Add `ExternalActivity` type, add `source?` and `externalWorkoutType?` to `workoutPreview` |
| `convex/tonal/proxy.ts` | Add `fetchExternalActivities` action                                                      |
| `convex/ai/context.ts`  | Add external activities to training snapshot with 7-day filter and HR labels              |
| `convex/ai/coach.ts`    | One-line system prompt addition for external activity awareness                           |
| `convex/dashboard.ts`   | Add `getExternalActivities` action, update `isTonalWorkout`                               |
| New UI component        | "Other Activities" dashboard section                                                      |
| `convex/tonal/cache.ts` | No changes — reuses `CACHE_TTLS.workoutHistory`                                           |

~7 files touched, 1 new UI component. No schema migrations, no new DB tables — all API-passthrough data.

## Testing

- Unit test for HR intensity label classification
- Unit test for 7-day window filtering
- Unit test for updated `isTonalWorkout` with `activityType: "External"` entries
- Verify training snapshot renders external activities correctly
- Verify dashboard displays external activities in separate section
- Verify existing Tonal workout flows are unaffected
