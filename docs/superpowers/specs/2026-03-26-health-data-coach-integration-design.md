# Health Data -> AI Coach Integration - Design Spec

**Date:** 2026-03-26
**Goal:** Pipe Apple Health data to the AI coach so it can make training recommendations informed by sleep, recovery, activity, body composition, and non-Tonal workouts.

---

## Approach

**Store everything, sync continuously.** iOS reads all available HealthKit data and syncs daily snapshots + individual non-Tonal workouts to Convex. The AI coach's context builder includes a "Health & Recovery" section in every conversation, with trend analysis and recovery signals. No coupling between sync and chat - the coach reads whatever the latest sync wrote.

**Sync triggers:**

1. App open (full sync, non-blocking)
2. Foreground return from background (debounced, skip if <60s since last sync)
3. Periodic foreground timer (every 15 min, lightweight - only fast-changing types)
4. Background delivery via `HKObserverQuery` (app terminated - iOS wakes us for new sleep, workouts, HRV)

---

## 1. HealthKit Data Collection (iOS)

### Expanded Read Types

Added to the existing `HealthKitManager.readTypes` set:

| Category    | HKIdentifier                 | What It Provides                                       | Source                         |
| ----------- | ---------------------------- | ------------------------------------------------------ | ------------------------------ |
| Sleep       | `sleepAnalysis`              | Duration, stages (deep/REM/core/awake), bed/wake times | Apple Watch                    |
| Heart       | `heartRateVariabilitySDNN`   | Daily readiness signal (ms)                            | Apple Watch                    |
| Heart       | `vo2Max`                     | Cardio fitness (mL/kg/min)                             | Apple Watch (outdoor workouts) |
| Heart       | `heartRateRecoveryOneMinute` | Post-workout HR drop (BPM)                             | Apple Watch                    |
| Activity    | `stepCount`                  | Daily activity baseline                                | iPhone (passive)               |
| Activity    | `flightsClimbed`             | Extra activity context                                 | iPhone (barometer)             |
| Body        | `bodyFatPercentage`          | Body composition (0-1)                                 | Smart scale sync               |
| Body        | `leanBodyMass`               | Fat-free mass (kg)                                     | Smart scale sync               |
| Nutrition   | `dietaryEnergyConsumed`      | Calorie intake (kcal)                                  | MFP/Noom sync                  |
| Nutrition   | `dietaryProtein`             | Protein intake (g)                                     | MFP/Noom sync                  |
| Effort      | `workoutEffortScore`         | Self-rated RPE (0-10)                                  | Apple Watch (watchOS 10+)      |
| Respiratory | `respiratoryRate`            | Breaths/min (sleep)                                    | Apple Watch                    |
| Respiratory | `oxygenSaturation`           | SpO2 (0-1)                                             | Apple Watch Series 6+          |

Already reading: `activeEnergyBurned`, `appleExerciseTime`, `appleStandHour`, `heartRate`, `restingHeartRate`, `bodyMass`, `HKWorkoutType`, `HKActivitySummaryType`.

### New HealthSyncManager

Separate from `HealthKitManager` (which owns raw queries and Health Dashboard UI state). `HealthSyncManager` owns:

- Building a structured `HealthSnapshot` from the latest HealthKit data
- Syncing to Convex via `health:syncSnapshot` and `health:syncWorkouts` mutations
- Managing all 4 sync triggers
- Expanding `HKObserverQuery` registrations for background delivery

Lives at `ios/TonalCoach/Health/HealthSyncManager.swift`.

### Background Delivery Registration

Register `HKObserverQuery` + `enableBackgroundDelivery` for:

- Sleep analysis: `.immediate` (new sleep session is high-value)
- Workouts: `.immediate` (completed workout should be available to coach fast)
- HRV: `.hourly` (periodic readings)
- Resting heart rate: `.hourly` (computed daily)
- Body mass: `.hourly` (smart scale syncs)
- VO2 Max: `.hourly` (updates infrequently)

When iOS wakes the app via background delivery, run a targeted sync for the triggered type only (not a full sync - we only have ~30s of background execution time).

---

## 2. Data Model (Convex Schema)

### healthSnapshots table

One row per user per day, upserted on each sync.

```
healthSnapshots {
  userId: v.id("users"),
  date: v.string(),              // "2026-03-26" - partition key
  syncedAt: v.number(),          // ms timestamp of last sync

  // Sleep (last night)
  sleepDurationMinutes: v.optional(v.number()),
  sleepDeepMinutes: v.optional(v.number()),
  sleepRemMinutes: v.optional(v.number()),
  sleepCoreMinutes: v.optional(v.number()),
  sleepAwakeMinutes: v.optional(v.number()),
  sleepStartTime: v.optional(v.string()),   // "22:45"
  sleepEndTime: v.optional(v.string()),     // "06:30"

  // Heart & Recovery
  restingHeartRate: v.optional(v.number()),
  hrvSDNN: v.optional(v.number()),          // milliseconds
  vo2Max: v.optional(v.number()),           // mL/kg/min
  heartRateRecovery: v.optional(v.number()), // BPM drop
  oxygenSaturation: v.optional(v.number()), // 0-1

  // Activity
  steps: v.optional(v.number()),
  activeEnergyBurned: v.optional(v.number()), // kcal
  exerciseMinutes: v.optional(v.number()),
  standHours: v.optional(v.number()),
  flightsClimbed: v.optional(v.number()),

  // Body
  bodyMass: v.optional(v.number()),         // kg
  bodyFatPercentage: v.optional(v.number()), // 0-1
  leanBodyMass: v.optional(v.number()),     // kg

  // Nutrition (from synced apps)
  dietaryCalories: v.optional(v.number()),
  dietaryProteinGrams: v.optional(v.number()),

  // Respiratory
  respiratoryRate: v.optional(v.number()),  // breaths/min

  // Effort
  workoutEffortScore: v.optional(v.number()), // 0-10
}
```

Index: `by_user_date` on `(userId, date)`.

### healthWorkouts table

Individual non-Tonal workouts synced from HealthKit.

```
healthWorkouts {
  userId: v.id("users"),
  healthKitUUID: v.string(),     // dedup key - prevents duplicate syncs
  activityType: v.string(),      // "running", "cycling", "yoga", etc.
  startTime: v.number(),         // ms timestamp
  endTime: v.number(),
  durationMinutes: v.number(),
  caloriesBurned: v.optional(v.number()),
  averageHeartRate: v.optional(v.number()),
  source: v.string(),            // "Strava", "Apple Watch", etc.
}
```

Index: `by_user_time` on `(userId, startTime)`.
Index: `by_uuid` on `(userId, healthKitUUID)` for dedup lookups.

### Design choices

- One snapshot per day, upserted. Latest sync wins. No append-only history.
- All health fields optional - not every user has Apple Watch, smart scale, or nutrition tracking.
- Non-Tonal workouts stored separately because the coach needs per-workout detail.
- Tonal workouts already tracked via the Tonal API - `healthWorkouts` only stores non-Tonal sources.
- Workouts deduped by `healthKitUUID` so repeated syncs are idempotent.

---

## 3. Sync Pipeline

### HealthSyncManager

New `@Observable` class at `ios/TonalCoach/Health/HealthSyncManager.swift`.

**State:**

- `lastSyncTime: Date?` - for debouncing
- `isSyncing: Bool` - prevents concurrent syncs
- Reference to `ConvexManager` and `HealthKitManager`

### Full sync flow (app open, foreground return)

```
1. Guard: skip if isSyncing or lastSync < 60s ago
2. Set isSyncing = true
3. Pull all data from HealthKit (parallel async queries):
   - Sleep: last night's session (sleepAnalysis samples, filter by stages)
   - HRV: latest reading
   - RHR: latest reading
   - VO2 Max: latest reading
   - HR Recovery: latest reading
   - Steps: today's cumulative sum
   - Active energy: today's cumulative sum
   - Exercise minutes: today's cumulative sum
   - Stand hours: today's count
   - Flights: today's cumulative sum
   - Weight: latest reading
   - Body fat: latest reading
   - Lean mass: latest reading
   - Calories consumed: today's cumulative sum
   - Protein: today's cumulative sum
   - Respiratory rate: latest reading (sleep)
   - SpO2: latest reading
   - Workout effort: latest
4. Build HealthSnapshot struct from results
5. Call Convex mutation "health:syncSnapshot" with snapshot
6. Pull non-Tonal workouts from last 7 days (HKWorkout samples)
7. Filter out Tonal-sourced workouts (source name contains "tonal")
8. Call Convex mutation "health:syncWorkouts" with workout array
9. Update lastSyncTime, set isSyncing = false
```

### Lightweight sync (periodic 15-min timer)

Only pulls fast-changing types: steps, active energy, exercise minutes, stand hours, flights. Upserts into today's snapshot. Skips sleep/HRV/weight/body comp since they don't change mid-day.

### Background delivery handler

When `HKObserverQuery` fires for a specific type:

1. Pull only the triggered data type
2. Upsert into today's snapshot (merge with existing fields, don't overwrite nulls)
3. If triggered by workout completion, also sync the new workout to `healthWorkouts`
4. Call `completionHandler()` within the ~30s budget

### Convex mutations

**`health:syncSnapshot`** (mutation):

- Auth: requires authenticated user
- Upserts by `(userId, date)` - if row exists for today, merges non-null fields
- Validates field ranges (e.g., steps >= 0, SpO2 0-1)

**`health:syncWorkouts`** (mutation):

- Auth: requires authenticated user
- Takes array of workouts
- For each: check if `healthKitUUID` exists, skip if so, insert if not
- Only processes last 7 days of workouts

### Error handling

Sync failures are silent to the user. No error banners, no blocking UI. The coach works fine with stale or missing health data - it just has less context. Errors are logged for debugging but never interrupt the UX.

### Integration points in TonalCoachApp.swift

```swift
// In .task block (app open):
healthSyncManager.setConvexManager(convexManager)
healthSyncManager.startSync()  // full sync + register observers + start timer

// In .onChange(of: scenePhase):
case .active: healthSyncManager.syncIfNeeded()  // debounced full sync
case .background: healthSyncManager.stopPeriodicTimer()
```

---

## 4. AI Coach Integration

### Context builder addition

In `convex/ai/context.ts`, add a new parallel data source alongside the existing 10:

```typescript
async function fetchHealthContext(userId: Id<"users">): Promise<string> {
  // Get today's snapshot + last 7 days for trends
  const snapshots = await getHealthSnapshots(userId, 7);
  // Get non-Tonal workouts from last 7 days
  const workouts = await getHealthWorkouts(userId, 7);

  if (snapshots.length === 0) return ""; // No health data - omit section entirely

  return buildHealthSummary(snapshots, workouts);
}
```

### Summary format

The health context section injected into the agent's training snapshot:

```
HEALTH & RECOVERY (from Apple Health):
Today: 7,842 steps | 423 kcal active | 38 min exercise
Last night: 6h 52m sleep (1h 12m deep, 1h 34m REM, 3h 28m core, 38m awake) | Bed 23:15 -> 06:07
Heart: RHR 58 bpm | HRV 42ms (7-day avg: 48ms, trending down) | VO2 Max 38.2
Body: 82.1 kg (7-day trend: -0.3 kg)
Nutrition: 2,150 kcal | 142g protein (if tracked)

Non-Tonal workouts (last 7 days):
- Mon 8:15am: Running 5.2 mi, 42 min, 156 avg HR (Strava)
- Wed 6:30pm: Yoga 45 min (Apple Watch)

Recovery signals: HRV declining 3 days (48->45->42ms), sleep below 7h target 2 of last 3 nights.
```

### Trend computation

Computed at query time from the 7-day snapshot history:

- **Trend direction**: Compare today vs 7-day average. Up/down/stable arrow.
- **Recovery signals**: Auto-generated warnings when patterns suggest issues:
  - HRV declining 3+ consecutive days
  - Sleep below 7h for 2+ of last 3 nights
  - RHR elevated 5+ BPM above 7-day average
  - Weight drop >1kg/week (overreaching risk with high training volume)

### Context priority

Health section gets **medium priority** in the context builder - above external activities but below strength scores and current schedule. If the 8000 char context budget is tight, historical detail trims first (remove individual workout entries, then trend details), keeping today's snapshot last.

### Graceful degradation

- No health data at all: section omitted entirely. No wasted context tokens.
- Partial data (e.g., no Apple Watch = no sleep/HRV): include what's available, skip what isn't.
- Stale data (last sync >24h ago): include but note "(last synced 2 days ago)" so the agent knows.

### System prompt addition

Add to `convex/ai/promptSections.ts`:

```
When health data is available, factor it into your recommendations:
- Low HRV or declining trend: suggest reducing volume or intensity, prioritize recovery
- Poor sleep (<6h or low deep sleep): reduce session difficulty, avoid heavy compounds
- High step count + workout day: account for accumulated fatigue
- Non-Tonal workouts: adjust programming to avoid overloading the same muscle groups
- Weight trending down + high training volume: watch for overreaching, consider deload
- Good recovery signals (high HRV, good sleep, stable RHR): green light for high intensity
Do not lecture about health metrics unless the user asks. Use the data silently to inform better programming.
```

---

## 5. Permissions & Privacy

### HealthKit authorization

Expand the existing `readTypes` set in `HealthKitManager` with all new types from Section 1. HealthKit shows one permission sheet - user toggles each type individually. We request everything, handle whatever they grant.

**Never request write access.** Read-only.

HealthKit deliberately hides which specific types the user denied. We attempt to read everything and get empty results for denied types. The sync handles nulls throughout.

### Info.plist update

Update `NSHealthShareUsageDescription`:
"TonalCoach reads your health data to provide personalized training recommendations based on your sleep, recovery, activity, and body composition."

### Data lifecycle

- Health snapshots retained indefinitely (historical trends are valuable for coaching).
- Non-Tonal workouts older than 90 days pruned via a scheduled Convex function (not MVP, add later if storage becomes a concern).
- Account deletion: delete all healthSnapshots and healthWorkouts for the user. Add to existing deletion flow.

### No new UI

The Health Dashboard already shows health data. The chat just gets smarter. No new screens or settings needed.

---

## 6. Implementation Scope

### iOS (3 files)

| File                                            | What                                                                                                                             |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `ios/TonalCoach/Health/HealthSyncManager.swift` | New - sync orchestration, snapshot builder, timer, background delivery                                                           |
| `ios/TonalCoach/Health/HealthKitManager.swift`  | Modify - expand readTypes, add new query methods for sleep stages, HRV, VO2 Max, steps, body fat, nutrition, respiratory, effort |
| `ios/TonalCoach/App/TonalCoachApp.swift`        | Modify - wire up HealthSyncManager, add scenePhase observer                                                                      |

### Convex (4 files)

| File                          | What                                                                  |
| ----------------------------- | --------------------------------------------------------------------- |
| `convex/schema.ts`            | Modify - add healthSnapshots and healthWorkouts tables                |
| `convex/health.ts`            | New - syncSnapshot mutation, syncWorkouts mutation, query helpers     |
| `convex/ai/context.ts`        | Modify - add health data source to parallel fetch, buildHealthSummary |
| `convex/ai/promptSections.ts` | Modify - add health coaching guidelines section                       |

### Info.plist

Update `NSHealthShareUsageDescription` text.
