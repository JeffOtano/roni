# Health Data -> AI Coach Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pipe Apple Health data (sleep, HRV, VO2 Max, steps, body comp, nutrition) to the AI coach so it silently makes smarter training recommendations.

**Architecture:** iOS `HealthSyncManager` collects HealthKit data via 4 triggers (app open, foreground return, periodic timer, background delivery) and syncs daily snapshots to a Convex `healthSnapshots` table. The AI context builder reads the last 7 days of snapshots, computes trends and recovery signals, and injects a "Health & Recovery" section into the coach's training context.

**Tech Stack:** SwiftUI (iOS 17+), HealthKit, ConvexMobile, Convex (TypeScript)

**Spec:** `docs/superpowers/specs/2026-03-26-health-data-coach-integration-design.md`

---

## File Map

### New Files

| File                                            | Responsibility                                                                   |
| ----------------------------------------------- | -------------------------------------------------------------------------------- |
| `ios/TonalCoach/Health/HealthSyncManager.swift` | Sync orchestration, snapshot builder, 4 sync triggers, background delivery       |
| `convex/health.ts`                              | `syncSnapshot` mutation, `getHealthSnapshots` query, `buildHealthSummary` helper |

### Modified Files

| File                                           | Changes                                                                                                                                 |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `ios/TonalCoach/Health/HealthKitManager.swift` | Expand `readTypes` with 13 new types, add query methods for sleep stages, HRV, VO2 Max, steps, body fat, nutrition, respiratory, effort |
| `ios/TonalCoach/App/TonalCoachApp.swift`       | Wire up HealthSyncManager, add `@Environment(\.scenePhase)`, add `onChange` handler                                                     |
| `convex/schema.ts`                             | Add `healthSnapshots` table definition                                                                                                  |
| `convex/ai/context.ts`                         | Add health data source to parallel fetch, insert "Health & Recovery" section at priority 8.5                                            |
| `convex/ai/promptSections.ts`                  | Add `healthCoaching()` section with guidelines for using health data                                                                    |
| `ios/TonalCoach/TonalCoach.entitlements`       | Add HealthKit background delivery                                                                                                       |
| `ios/TonalCoach.xcodeproj/project.pbxproj`     | Add `background-fetch` to Background Modes, add new file reference                                                                      |
| `ios/TonalCoach/Info.plist`                    | Update `NSHealthShareUsageDescription`                                                                                                  |

---

## Task 1: Convex Schema - healthSnapshots Table

**Files:**

- Modify: `convex/schema.ts`

- [ ] **Step 1: Add healthSnapshots table**

Insert after the `strengthScoreSnapshots` table definition (around line 462). Follow the existing pattern:

```typescript
healthSnapshots: defineTable({
  userId: v.id("users"),
  date: v.string(),
  syncedAt: v.number(),

  // Sleep
  sleepDurationMinutes: v.optional(v.number()),
  sleepDeepMinutes: v.optional(v.number()),
  sleepRemMinutes: v.optional(v.number()),
  sleepCoreMinutes: v.optional(v.number()),
  sleepAwakeMinutes: v.optional(v.number()),
  sleepStartTime: v.optional(v.string()),
  sleepEndTime: v.optional(v.string()),

  // Heart & Recovery
  restingHeartRate: v.optional(v.number()),
  hrvSDNN: v.optional(v.number()),
  vo2Max: v.optional(v.number()),
  heartRateRecovery: v.optional(v.number()),
  oxygenSaturation: v.optional(v.number()),

  // Activity
  steps: v.optional(v.number()),
  activeEnergyBurned: v.optional(v.number()),
  exerciseMinutes: v.optional(v.number()),
  standHours: v.optional(v.number()),
  flightsClimbed: v.optional(v.number()),

  // Body
  bodyMass: v.optional(v.number()),
  bodyFatPercentage: v.optional(v.number()),
  leanBodyMass: v.optional(v.number()),

  // Nutrition
  dietaryCalories: v.optional(v.number()),
  dietaryProteinGrams: v.optional(v.number()),

  // Respiratory
  respiratoryRate: v.optional(v.number()),

  // Effort
  workoutEffortScore: v.optional(v.number()),
})
  .index("by_userId_date", ["userId", "date"])
  .index("by_userId", ["userId"]),
```

- [ ] **Step 2: Verify schema pushes**

Run: `npx convex dev --once`
Expected: Schema validation passes, `healthSnapshots` table created

- [ ] **Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "feat: add healthSnapshots table to Convex schema"
```

---

## Task 2: Convex health.ts - Sync Mutation + Query Helpers

**Files:**

- Create: `convex/health.ts`

- [ ] **Step 1: Read Convex guidelines**

Read `convex/_generated/ai/guidelines.md` for patterns. Key rules: use `v.object()` for args, `.withIndex()` not `.filter()`, `ctx.db.patch()` for merges.

- [ ] **Step 2: Create convex/health.ts with syncSnapshot mutation**

```typescript
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Upserts a daily health snapshot. Merges non-null fields into existing row.
export const syncSnapshot = mutation({
  args: {
    date: v.string(),
    syncedAt: v.number(),

    sleepDurationMinutes: v.optional(v.number()),
    sleepDeepMinutes: v.optional(v.number()),
    sleepRemMinutes: v.optional(v.number()),
    sleepCoreMinutes: v.optional(v.number()),
    sleepAwakeMinutes: v.optional(v.number()),
    sleepStartTime: v.optional(v.string()),
    sleepEndTime: v.optional(v.string()),

    restingHeartRate: v.optional(v.number()),
    hrvSDNN: v.optional(v.number()),
    vo2Max: v.optional(v.number()),
    heartRateRecovery: v.optional(v.number()),
    oxygenSaturation: v.optional(v.number()),

    steps: v.optional(v.number()),
    activeEnergyBurned: v.optional(v.number()),
    exerciseMinutes: v.optional(v.number()),
    standHours: v.optional(v.number()),
    flightsClimbed: v.optional(v.number()),

    bodyMass: v.optional(v.number()),
    bodyFatPercentage: v.optional(v.number()),
    leanBodyMass: v.optional(v.number()),

    dietaryCalories: v.optional(v.number()),
    dietaryProteinGrams: v.optional(v.number()),

    respiratoryRate: v.optional(v.number()),

    workoutEffortScore: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Look up user by auth identity
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    // Build patch object from non-undefined fields
    const patch: Record<string, unknown> = { syncedAt: args.syncedAt };
    const fields = [
      "sleepDurationMinutes",
      "sleepDeepMinutes",
      "sleepRemMinutes",
      "sleepCoreMinutes",
      "sleepAwakeMinutes",
      "sleepStartTime",
      "sleepEndTime",
      "restingHeartRate",
      "hrvSDNN",
      "vo2Max",
      "heartRateRecovery",
      "oxygenSaturation",
      "steps",
      "activeEnergyBurned",
      "exerciseMinutes",
      "standHours",
      "flightsClimbed",
      "bodyMass",
      "bodyFatPercentage",
      "leanBodyMass",
      "dietaryCalories",
      "dietaryProteinGrams",
      "respiratoryRate",
      "workoutEffortScore",
    ] as const;

    for (const field of fields) {
      if (args[field] !== undefined) {
        patch[field] = args[field];
      }
    }

    // Upsert: patch existing or insert new
    const existing = await ctx.db
      .query("healthSnapshots")
      .withIndex("by_userId_date", (q) => q.eq("userId", user._id).eq("date", args.date))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, patch);
    } else {
      await ctx.db.insert("healthSnapshots", {
        userId: user._id,
        date: args.date,
        ...patch,
      } as any);
    }
  },
});

// Query last N days of health snapshots for a user.
export const getRecentSnapshots = query({
  args: {
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return [];

    const days = args.days ?? 7;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().split("T")[0];

    return await ctx.db
      .query("healthSnapshots")
      .withIndex("by_userId_date", (q) => q.eq("userId", user._id).gte("date", cutoffStr))
      .collect();
  },
});
```

Note: The auth lookup pattern (`by_clerkId`) should match whatever the existing codebase uses. Read `convex/users.ts` or other mutations to verify the exact index name and field used for user lookup.

- [ ] **Step 3: Verify**

Run: `npx convex dev --once`
Expected: Functions deployed, no errors

- [ ] **Step 4: Commit**

```bash
git add convex/health.ts
git commit -m "feat: add health syncSnapshot mutation and getRecentSnapshots query"
```

---

## Task 3: AI Context Builder - Health Section

**Files:**

- Modify: `convex/ai/context.ts`
- Modify: `convex/ai/promptSections.ts`

- [ ] **Step 1: Add health data to parallel fetch in context.ts**

In `buildTrainingSnapshot`, add to the `Promise.all` array (around line 95):

```typescript
ctx.runQuery(internal.health.getRecentSnapshots, { days: 7 }).catch(() => []),
```

Add the result to the destructured array. Then after the existing section-building blocks, add:

```typescript
// Health & Recovery
if (healthSnapshots && healthSnapshots.length > 0) {
  const healthLines = buildHealthSummary(healthSnapshots);
  if (healthLines.length > 0) {
    sections.push({ priority: 8.5, lines: healthLines });
  }
}
```

- [ ] **Step 2: Implement buildHealthSummary function**

Add to `context.ts` (or a helper file):

```typescript
function buildHealthSummary(snapshots: any[]): string[] {
  const lines: string[] = ["HEALTH & RECOVERY (from Apple Health):"];
  const today = snapshots.find((s) => s.date === new Date().toISOString().split("T")[0]);
  const sorted = [...snapshots].sort((a, b) => b.date.localeCompare(a.date));

  if (!today && sorted.length === 0) return [];

  const latest = today ?? sorted[0];

  // Today's activity
  const activityParts: string[] = [];
  if (latest.steps != null) activityParts.push(`${latest.steps.toLocaleString()} steps`);
  if (latest.activeEnergyBurned != null)
    activityParts.push(`${Math.round(latest.activeEnergyBurned)} kcal active`);
  if (latest.exerciseMinutes != null)
    activityParts.push(`${Math.round(latest.exerciseMinutes)} min exercise`);
  if (activityParts.length > 0) lines.push(`  Today: ${activityParts.join(" | ")}`);

  // Sleep
  if (latest.sleepDurationMinutes != null) {
    const hrs = Math.floor(latest.sleepDurationMinutes / 60);
    const mins = Math.round(latest.sleepDurationMinutes % 60);
    let sleepLine = `  Last night: ${hrs}h ${mins}m sleep`;
    const stages: string[] = [];
    if (latest.sleepDeepMinutes != null)
      stages.push(`${Math.round(latest.sleepDeepMinutes)}m deep`);
    if (latest.sleepRemMinutes != null) stages.push(`${Math.round(latest.sleepRemMinutes)}m REM`);
    if (latest.sleepCoreMinutes != null)
      stages.push(`${Math.round(latest.sleepCoreMinutes)}m core`);
    if (stages.length > 0) sleepLine += ` (${stages.join(", ")})`;
    if (latest.sleepStartTime && latest.sleepEndTime) {
      sleepLine += ` | Bed ${latest.sleepStartTime} -> ${latest.sleepEndTime}`;
    }
    lines.push(sleepLine);
  }

  // Heart
  const heartParts: string[] = [];
  if (latest.restingHeartRate != null)
    heartParts.push(`RHR ${Math.round(latest.restingHeartRate)} bpm`);
  if (latest.hrvSDNN != null) {
    let hrvStr = `HRV ${Math.round(latest.hrvSDNN)}ms`;
    const hrvValues = sorted.map((s) => s.hrvSDNN).filter((v): v is number => v != null);
    if (hrvValues.length >= 3) {
      const avg = hrvValues.reduce((a, b) => a + b, 0) / hrvValues.length;
      const trend =
        latest.hrvSDNN > avg * 1.05 ? "up" : latest.hrvSDNN < avg * 0.95 ? "down" : "stable";
      hrvStr += ` (7-day avg: ${Math.round(avg)}ms, trending ${trend})`;
    }
    heartParts.push(hrvStr);
  }
  if (latest.vo2Max != null) heartParts.push(`VO2 Max ${latest.vo2Max.toFixed(1)}`);
  if (heartParts.length > 0) lines.push(`  Heart: ${heartParts.join(" | ")}`);

  // Body
  const bodyParts: string[] = [];
  if (latest.bodyMass != null) {
    let massStr = `${latest.bodyMass.toFixed(1)} kg`;
    const weights = sorted.map((s) => s.bodyMass).filter((v): v is number => v != null);
    if (weights.length >= 2) {
      const diff = weights[0] - weights[weights.length - 1];
      massStr += ` (7-day trend: ${diff > 0 ? "+" : ""}${diff.toFixed(1)} kg)`;
    }
    bodyParts.push(massStr);
  }
  if (latest.bodyFatPercentage != null)
    bodyParts.push(`${(latest.bodyFatPercentage * 100).toFixed(1)}% body fat`);
  if (bodyParts.length > 0) lines.push(`  Body: ${bodyParts.join(" | ")}`);

  // Nutrition
  const nutritionParts: string[] = [];
  if (latest.dietaryCalories != null)
    nutritionParts.push(`${Math.round(latest.dietaryCalories)} kcal`);
  if (latest.dietaryProteinGrams != null)
    nutritionParts.push(`${Math.round(latest.dietaryProteinGrams)}g protein`);
  if (nutritionParts.length > 0) lines.push(`  Nutrition: ${nutritionParts.join(" | ")}`);

  // Recovery signals
  const signals: string[] = [];
  const hrvValues = sorted.map((s) => s.hrvSDNN).filter((v): v is number => v != null);
  if (hrvValues.length >= 3 && hrvValues[0] < hrvValues[1] && hrvValues[1] < hrvValues[2]) {
    signals.push(
      `HRV declining ${hrvValues.length} days (${hrvValues.reverse().map(Math.round).join("->")}ms)`,
    );
  }
  const sleepValues = sorted
    .slice(0, 3)
    .map((s) => s.sleepDurationMinutes)
    .filter((v): v is number => v != null);
  const poorSleep = sleepValues.filter((m) => m < 420).length; // 420 min = 7h
  if (poorSleep >= 2)
    signals.push(`sleep below 7h ${poorSleep} of last ${sleepValues.length} nights`);
  if (signals.length > 0) lines.push(`  Recovery signals: ${signals.join(", ")}`);

  // Stale data warning
  if (latest.syncedAt) {
    const hoursSinceSync = (Date.now() - latest.syncedAt) / 3600000;
    if (hoursSinceSync > 24) {
      lines.push(`  (last synced ${Math.round(hoursSinceSync / 24)} days ago)`);
    }
  }

  return lines.length <= 1 ? [] : lines;
}
```

- [ ] **Step 3: Consider bumping SNAPSHOT_MAX_CHARS**

In `convex/ai/snapshotHelpers.ts` (or wherever `SNAPSHOT_MAX_CHARS` is defined), increase from 8000 to 9000 to accommodate the new health section without trimming existing ones.

- [ ] **Step 4: Add healthCoaching section to promptSections.ts**

Add a new function after `volumeAndRotation()`:

```typescript
export function healthCoaching(): string {
  return `HEALTH COACHING:
When health data is available, factor it into your recommendations:
- Low HRV or declining trend: suggest reducing volume or intensity, prioritize recovery
- Poor sleep (<6h or low deep sleep): reduce session difficulty, avoid heavy compounds
- High step count + workout day: account for accumulated fatigue
- Non-Tonal workouts: adjust programming to avoid overloading the same muscle groups
- Weight trending down + high training volume: watch for overreaching, consider deload
- Good recovery signals (high HRV, good sleep, stable RHR): green light for high intensity
Do not lecture about health metrics unless the user asks. Use the data silently to inform better programming.`;
}
```

Add `healthCoaching` to the `ALL_SECTIONS` array and `"HEALTH COACHING"` to `SECTION_NAMES`.

- [ ] **Step 5: Make getRecentSnapshots available internally**

If `buildTrainingSnapshot` uses `ctx.runQuery(internal.health...)`, the query needs to be exported as `internalQuery` or you need an internal wrapper. Read how existing internal queries are called in `context.ts` and match the pattern.

- [ ] **Step 6: Verify**

Run: `npx convex dev --once`
Expected: All functions deploy, no type errors

Run: `npx tsc --noEmit`
Expected: No TypeScript errors

- [ ] **Step 7: Commit**

```bash
git add convex/ai/context.ts convex/ai/promptSections.ts convex/ai/snapshotHelpers.ts convex/health.ts
git commit -m "feat: add Health & Recovery section to AI coach context with trend analysis"
```

---

## Task 4: Expand HealthKit Read Types

**Files:**

- Modify: `ios/TonalCoach/Health/HealthKitManager.swift`

- [ ] **Step 1: Add new types to readTypes set**

In `HealthKitManager.readTypes` (around line 107-130), add these after the existing types:

```swift
// Sleep
if let sleepType = HKCategoryType.categoryType(forIdentifier: .sleepAnalysis) {
    types.insert(sleepType)
}
// HRV
if let hrv = HKQuantityType.quantityType(forIdentifier: .heartRateVariabilitySDNN) {
    types.insert(hrv)
}
// VO2 Max
if let vo2 = HKQuantityType.quantityType(forIdentifier: .vo2Max) {
    types.insert(vo2)
}
// Heart Rate Recovery
if let hrRecovery = HKQuantityType.quantityType(forIdentifier: .heartRateRecoveryOneMinute) {
    types.insert(hrRecovery)
}
// Steps
if let steps = HKQuantityType.quantityType(forIdentifier: .stepCount) {
    types.insert(steps)
}
// Flights Climbed
if let flights = HKQuantityType.quantityType(forIdentifier: .flightsClimbed) {
    types.insert(flights)
}
// Body Fat
if let bodyFat = HKQuantityType.quantityType(forIdentifier: .bodyFatPercentage) {
    types.insert(bodyFat)
}
// Lean Body Mass
if let leanMass = HKQuantityType.quantityType(forIdentifier: .leanBodyMass) {
    types.insert(leanMass)
}
// Dietary Energy
if let calories = HKQuantityType.quantityType(forIdentifier: .dietaryEnergyConsumed) {
    types.insert(calories)
}
// Dietary Protein
if let protein = HKQuantityType.quantityType(forIdentifier: .dietaryProtein) {
    types.insert(protein)
}
// Workout Effort
if let effort = HKQuantityType.quantityType(forIdentifier: .workoutEffortScore) {
    types.insert(effort)
}
// Respiratory Rate
if let respRate = HKQuantityType.quantityType(forIdentifier: .respiratoryRate) {
    types.insert(respRate)
}
// Blood Oxygen
if let spo2 = HKQuantityType.quantityType(forIdentifier: .oxygenSaturation) {
    types.insert(spo2)
}
```

- [ ] **Step 2: Add query methods for new types**

Add these methods to `HealthKitManager`. They follow the existing patterns (`fetchTodayCumulativeSum`, `fetchRestingHeartRate`):

**Sleep stages** - query `sleepAnalysis` category samples for last night:

```swift
func fetchLastNightSleep() async throws -> SleepData? {
    // Query sleepAnalysis samples from yesterday 6pm to today noon
    // Filter by .asleepDeep, .asleepREM, .asleepCore, .awake stages
    // Sum duration per stage, compute bed/wake times
}
```

**Latest reading queries** (HRV, VO2 Max, HR Recovery, body fat, lean mass, respiratory rate, SpO2, effort):

```swift
func fetchLatestQuantity(for identifier: HKQuantityTypeIdentifier, unit: HKUnit) async throws -> Double? {
    // Generic helper: fetch latest sample for a quantity type
    // Return its doubleValue in the given unit
}
```

**Cumulative sums** (steps, flights, dietary calories, dietary protein):
Use the existing `fetchTodayCumulativeSum(for:unit:)` method.

**SleepData struct:**

```swift
struct SleepData {
    let durationMinutes: Double
    let deepMinutes: Double?
    let remMinutes: Double?
    let coreMinutes: Double?
    let awakeMinutes: Double?
    let startTime: String? // "22:45"
    let endTime: String?   // "06:30"
}
```

- [ ] **Step 3: Build and verify**

Run: `cd ios && xcodebuild -scheme TonalCoach -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' build 2>&1 | tail -5`
Expected: BUILD SUCCEEDED

- [ ] **Step 4: Commit**

```bash
git add ios/TonalCoach/Health/HealthKitManager.swift
git commit -m "feat(ios): expand HealthKit read types and add query methods for 13 new data types"
```

---

## Task 5: HealthSyncManager - Snapshot Builder + Sync

**Files:**

- Create: `ios/TonalCoach/Health/HealthSyncManager.swift`

- [ ] **Step 1: Create HealthSyncManager.swift**

```swift
import Combine
import ConvexMobile
import HealthKit
import SwiftUI

@Observable
final class HealthSyncManager {
    private(set) var lastSyncTime: Date?
    private(set) var isSyncing = false

    private var convexManager: ConvexManager?
    private var healthKitManager: HealthKitManager?
    private var periodicTimer: Timer?
    private let healthStore = HKHealthStore()
    private var observerQueries: [HKObserverQuery] = []

    // MARK: - Setup

    func configure(convex: ConvexManager, health: HealthKitManager) {
        self.convexManager = convex
        self.healthKitManager = health
    }

    // MARK: - Start (called on app open)

    func startSync() {
        Task { await performFullSync() }
        registerBackgroundDelivery()
        startPeriodicTimer()
    }

    // MARK: - Debounced sync (foreground return)

    func syncIfNeeded() {
        guard let last = lastSyncTime else {
            Task { await performFullSync() }
            return
        }
        if Date().timeIntervalSince(last) > 60 {
            Task { await performFullSync() }
        }
    }

    // MARK: - Full Sync

    func performFullSync() async {
        guard !isSyncing, let health = healthKitManager, let convex = convexManager else { return }
        isSyncing = true
        defer { isSyncing = false; lastSyncTime = Date() }

        do {
            let snapshot = try await buildSnapshot(health: health)
            try await syncToConvex(snapshot: snapshot, convex: convex)
        } catch {
            // Silent failure - coach works fine without health data
            print("[HealthSync] Full sync failed: \(error.localizedDescription)")
        }
    }

    // MARK: - Lightweight Sync (periodic, activity-only)

    private func performLightweightSync() async {
        guard !isSyncing, let health = healthKitManager, let convex = convexManager else { return }
        isSyncing = true
        defer { isSyncing = false; lastSyncTime = Date() }

        do {
            let today = dateString()
            let steps = try? await health.fetchTodayCumulativeSum(for: .stepCount, unit: .count())
            let energy = try? await health.fetchTodayCumulativeSum(for: .activeEnergyBurned, unit: .kilocalorie())
            let exercise = try? await health.fetchTodayCumulativeSum(for: .appleExerciseTime, unit: .minute())
            let flights = try? await health.fetchTodayCumulativeSum(for: .flightsClimbed, unit: .count())

            var args: [String: ConvexEncodable?] = [
                "date": today,
                "syncedAt": Double(Date().timeIntervalSince1970 * 1000),
            ]
            if let steps { args["steps"] = steps }
            if let energy { args["activeEnergyBurned"] = energy }
            if let exercise { args["exerciseMinutes"] = exercise }
            if let flights { args["flightsClimbed"] = flights }

            let _: Void = try await convex.mutation("health:syncSnapshot", with: args)
        } catch {
            print("[HealthSync] Lightweight sync failed: \(error.localizedDescription)")
        }
    }

    // MARK: - Build Snapshot

    private func buildSnapshot(health: HealthKitManager) async throws -> [String: ConvexEncodable?] {
        let today = dateString()

        // Parallel fetch all data types
        async let sleep = health.fetchLastNightSleep()
        async let hrv = health.fetchLatestQuantity(for: .heartRateVariabilitySDNN, unit: .secondUnit(with: .milli))
        async let rhr = health.fetchLatestQuantity(for: .restingHeartRate, unit: HKUnit.count().unitDivided(by: .minute()))
        async let vo2 = health.fetchLatestQuantity(for: .vo2Max, unit: HKUnit(from: "ml/kg*min"))
        async let hrRecovery = health.fetchLatestQuantity(for: .heartRateRecoveryOneMinute, unit: HKUnit.count().unitDivided(by: .minute()))
        async let spo2 = health.fetchLatestQuantity(for: .oxygenSaturation, unit: .percent())
        async let steps = health.fetchTodayCumulativeSum(for: .stepCount, unit: .count())
        async let energy = health.fetchTodayCumulativeSum(for: .activeEnergyBurned, unit: .kilocalorie())
        async let exercise = health.fetchTodayCumulativeSum(for: .appleExerciseTime, unit: .minute())
        async let flights = health.fetchTodayCumulativeSum(for: .flightsClimbed, unit: .count())
        async let weight = health.fetchLatestQuantity(for: .bodyMass, unit: .gramUnit(with: .kilo))
        async let bodyFat = health.fetchLatestQuantity(for: .bodyFatPercentage, unit: .percent())
        async let leanMass = health.fetchLatestQuantity(for: .leanBodyMass, unit: .gramUnit(with: .kilo))
        async let calories = health.fetchTodayCumulativeSum(for: .dietaryEnergyConsumed, unit: .kilocalorie())
        async let protein = health.fetchTodayCumulativeSum(for: .dietaryProtein, unit: .gram())
        async let respRate = health.fetchLatestQuantity(for: .respiratoryRate, unit: HKUnit.count().unitDivided(by: .minute()))
        async let effort = health.fetchLatestQuantity(for: .workoutEffortScore, unit: .count())

        // Await all (try? to handle individual failures gracefully)
        let sleepData = try? await sleep
        let hrvVal = try? await hrv
        let rhrVal = try? await rhr
        let vo2Val = try? await vo2
        let hrRecoveryVal = try? await hrRecovery
        let spo2Val = try? await spo2
        let stepsVal = try? await steps
        let energyVal = try? await energy
        let exerciseVal = try? await exercise
        let flightsVal = try? await flights
        let weightVal = try? await weight
        let bodyFatVal = try? await bodyFat
        let leanMassVal = try? await leanMass
        let caloriesVal = try? await calories
        let proteinVal = try? await protein
        let respRateVal = try? await respRate
        let effortVal = try? await effort

        // Build args dict - only include non-nil values
        var args: [String: ConvexEncodable?] = [
            "date": today,
            "syncedAt": Double(Date().timeIntervalSince1970 * 1000),
        ]

        if let s = sleepData {
            args["sleepDurationMinutes"] = s.durationMinutes
            if let v = s.deepMinutes { args["sleepDeepMinutes"] = v }
            if let v = s.remMinutes { args["sleepRemMinutes"] = v }
            if let v = s.coreMinutes { args["sleepCoreMinutes"] = v }
            if let v = s.awakeMinutes { args["sleepAwakeMinutes"] = v }
            if let v = s.startTime { args["sleepStartTime"] = v }
            if let v = s.endTime { args["sleepEndTime"] = v }
        }

        if let v = rhrVal { args["restingHeartRate"] = v }
        if let v = hrvVal { args["hrvSDNN"] = v }
        if let v = vo2Val { args["vo2Max"] = v }
        if let v = hrRecoveryVal { args["heartRateRecovery"] = v }
        if let v = spo2Val { args["oxygenSaturation"] = v }
        if let v = stepsVal, v > 0 { args["steps"] = v }
        if let v = energyVal, v > 0 { args["activeEnergyBurned"] = v }
        if let v = exerciseVal, v > 0 { args["exerciseMinutes"] = v }
        if let v = flightsVal, v > 0 { args["flightsClimbed"] = v }
        if let v = weightVal { args["bodyMass"] = v }
        if let v = bodyFatVal { args["bodyFatPercentage"] = v }
        if let v = leanMassVal { args["leanBodyMass"] = v }
        if let v = caloriesVal, v > 0 { args["dietaryCalories"] = v }
        if let v = proteinVal, v > 0 { args["dietaryProteinGrams"] = v }
        if let v = respRateVal { args["respiratoryRate"] = v }
        if let v = effortVal { args["workoutEffortScore"] = v }

        return args
    }

    // MARK: - Sync to Convex

    private func syncToConvex(snapshot: [String: ConvexEncodable?], convex: ConvexManager) async throws {
        let _: Void = try await convex.mutation("health:syncSnapshot", with: snapshot)
    }

    // MARK: - Periodic Timer

    func startPeriodicTimer() {
        stopPeriodicTimer()
        periodicTimer = Timer.scheduledTimer(withTimeInterval: 900, repeats: true) { [weak self] _ in
            Task { await self?.performLightweightSync() }
        }
    }

    func stopPeriodicTimer() {
        periodicTimer?.invalidate()
        periodicTimer = nil
    }

    // MARK: - Background Delivery

    private func registerBackgroundDelivery() {
        let typesAndFrequency: [(HKObjectType, HKUpdateFrequency)] = [
            (HKCategoryType.categoryType(forIdentifier: .sleepAnalysis)!, .immediate),
            (HKObjectType.workoutType(), .immediate),
            (HKQuantityType.quantityType(forIdentifier: .heartRateVariabilitySDNN)!, .hourly),
            (HKQuantityType.quantityType(forIdentifier: .restingHeartRate)!, .hourly),
            (HKQuantityType.quantityType(forIdentifier: .bodyMass)!, .hourly),
            (HKQuantityType.quantityType(forIdentifier: .vo2Max)!, .hourly),
        ]

        for (type, frequency) in typesAndFrequency {
            let sampleType = type as! HKSampleType
            healthStore.enableBackgroundDelivery(for: sampleType, frequency: frequency) { success, error in
                if let error {
                    print("[HealthSync] Background delivery registration failed for \(type): \(error)")
                }
            }

            let query = HKObserverQuery(sampleType: sampleType, predicate: nil) { [weak self] _, completionHandler, error in
                guard error == nil, let self else {
                    completionHandler()
                    return
                }
                Task {
                    await self.performFullSync()
                    completionHandler()
                }
            }
            healthStore.execute(query)
            observerQueries.append(query)
        }
    }

    // MARK: - Cleanup

    func stopObserving() {
        for query in observerQueries {
            healthStore.stop(query)
        }
        observerQueries.removeAll()
        stopPeriodicTimer()
    }

    // MARK: - Helpers

    private func dateString() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: Date())
    }
}
```

- [ ] **Step 2: Add file to Xcode project**

Add `HealthSyncManager.swift` to project.pbxproj in the Health group and Sources build phase.

- [ ] **Step 3: Build and verify**

Run: `cd ios && xcodebuild -scheme TonalCoach -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' build 2>&1 | tail -5`
Expected: BUILD SUCCEEDED

- [ ] **Step 4: Commit**

```bash
git add ios/TonalCoach/Health/HealthSyncManager.swift ios/TonalCoach.xcodeproj/
git commit -m "feat(ios): add HealthSyncManager with full sync, lightweight sync, and background delivery"
```

---

## Task 6: Wire Up Sync in TonalCoachApp

**Files:**

- Modify: `ios/TonalCoach/App/TonalCoachApp.swift`

- [ ] **Step 1: Add HealthSyncManager state and scenePhase**

Add to the state properties:

```swift
@State private var healthSyncManager = HealthSyncManager()
@Environment(\.scenePhase) private var scenePhase
```

- [ ] **Step 2: Wire up in .task block**

After the existing `authManager.restoreSession()` and `subscribeToUserInfo()` calls, add:

```swift
// Health sync setup
healthSyncManager.configure(convex: convexManager, health: healthKitManager)
if healthKitManager.isAuthorized {
    healthSyncManager.startSync()
}
```

- [ ] **Step 3: Add scenePhase observer**

Add to the root view's modifiers (after `.onOpenURL`):

```swift
.onChange(of: scenePhase) { _, newPhase in
    switch newPhase {
    case .active:
        healthSyncManager.syncIfNeeded()
        healthSyncManager.startPeriodicTimer()
    case .background:
        healthSyncManager.stopPeriodicTimer()
    default:
        break
    }
}
```

- [ ] **Step 4: Start sync after HealthKit authorization**

In the existing flow where HealthKit gets authorized (likely in `HealthPermissionView` or after `requestAuthorization()`), trigger sync start. This may require passing `healthSyncManager` through the environment or calling `startSync()` after auth completes.

- [ ] **Step 5: Build and verify**

Run: `cd ios && xcodebuild -scheme TonalCoach -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' build 2>&1 | tail -5`
Expected: BUILD SUCCEEDED

- [ ] **Step 6: Commit**

```bash
git add ios/TonalCoach/App/TonalCoachApp.swift
git commit -m "feat(ios): wire HealthSyncManager into app lifecycle with scenePhase observer"
```

---

## Task 7: Entitlements & Info.plist

**Files:**

- Modify: `ios/TonalCoach/TonalCoach.entitlements`
- Modify: `ios/TonalCoach.xcodeproj/project.pbxproj`
- Modify: `ios/TonalCoach/Info.plist`

- [ ] **Step 1: Add background-fetch to Background Modes**

In `project.pbxproj` (or `Info.plist`), find the `UIBackgroundModes` array and add `"fetch"` alongside the existing `"remote-notification"`:

```xml
<key>UIBackgroundModes</key>
<array>
    <string>remote-notification</string>
    <string>fetch</string>
</array>
```

- [ ] **Step 2: Add HealthKit background delivery entitlement**

In `TonalCoach.entitlements`, update the `com.apple.developer.healthkit.access` array to include background delivery (the exact key may vary - check Apple's current documentation for the correct entitlement key format).

- [ ] **Step 3: Update NSHealthShareUsageDescription**

In `Info.plist`, update the value to:
"TonalCoach reads your health data to provide personalized training recommendations based on your sleep, recovery, activity, and body composition."

- [ ] **Step 4: Build and verify**

Run: `cd ios && xcodebuild -scheme TonalCoach -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' build 2>&1 | tail -5`
Expected: BUILD SUCCEEDED

- [ ] **Step 5: Commit**

```bash
git add ios/TonalCoach/TonalCoach.entitlements ios/TonalCoach.xcodeproj/ ios/TonalCoach/Info.plist
git commit -m "feat(ios): add background-fetch mode and update HealthKit permissions description"
```

---

## Task 8: End-to-End Verification

- [ ] **Step 1: Full backend verification**

Run: `npx convex dev --once`
Expected: All functions deploy, schema valid

Run: `npx tsc --noEmit`
Expected: No TypeScript errors

- [ ] **Step 2: Full iOS build**

Run: `cd ios && xcodebuild -scheme TonalCoach -destination 'platform=iOS Simulator,name=iPhone 17 Pro Max' build 2>&1 | tail -5`
Expected: BUILD SUCCEEDED

- [ ] **Step 3: Manual test flow**

1. Run the app in Simulator
2. Sign in, complete onboarding if needed
3. Verify no crashes on launch (sync fires silently)
4. Open Chat tab, send "How's my recovery looking?"
5. The coach should reference health data if any exists, or respond normally if no HealthKit data is available (Simulator has limited health data)

- [ ] **Step 4: Verify context builder**

Check Convex dashboard logs for the `health:syncSnapshot` mutation being called. Verify the `buildTrainingSnapshot` function includes the health section in its output.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: address issues from health data integration verification"
```
