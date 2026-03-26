# Unified Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the iOS dashboard to synthesize Tonal training + Apple Health recovery into a holistic readiness-centered view.

**Architecture:** Backend-first. Add readiness score query and coach insight action to Convex, then build 6 new iOS card components, then rewire the dashboard layout. Each card is independent and loads via AsyncCard.

**Tech Stack:** Convex (TypeScript), SwiftUI (iOS 17+), @convex-dev/agent for coach insight

**Spec:** `docs/superpowers/specs/2026-03-26-unified-dashboard-design.md`

---

## File Map

### New Files

| File                                            | Responsibility                              |
| ----------------------------------------------- | ------------------------------------------- |
| `ios/TonalCoach/Tonal/ReadinessCard.swift`      | Hero readiness ring + 4 factor pills        |
| `ios/TonalCoach/Tonal/SleepCard.swift`          | Sleep summary, stage bar, 7-day mini trend  |
| `ios/TonalCoach/Tonal/TrainingLoadCard.swift`   | 7-day day-circle timeline + workout summary |
| `ios/TonalCoach/Tonal/BodyHeartCard.swift`      | Weight + HRV sparklines, RHR trend          |
| `ios/TonalCoach/Shared/SparklineView.swift`     | Reusable animated 7-day sparkline           |
| `ios/TonalCoach/Tonal/CoachInsightBanner.swift` | AI-generated insight line                   |

### Modified Files

| File                                            | Changes                                                    |
| ----------------------------------------------- | ---------------------------------------------------------- |
| `convex/dashboard.ts`                           | Add `getReadinessScore` query and `getCoachInsight` action |
| `convex/schema.ts`                              | Add `coachInsight` field to healthSnapshots                |
| `ios/TonalCoach/Tonal/TonalDashboardView.swift` | Replace 5 old cards with new layout                        |
| `ios/TonalCoach/Tonal/StrengthScoreCard.swift`  | Add compact variant                                        |
| `ios/TonalCoach/App/ContentView.swift`          | Remove Health/Tonal dashboard split - always show unified  |
| `ios/TonalCoach/Shared/Models.swift`            | Add ReadinessScore and CoachInsight Decodable types        |

---

## Task 1: Readiness Score Backend

**Files:**

- Modify: `convex/dashboard.ts`
- Modify: `convex/schema.ts`

- [ ] **Step 1: Add coachInsight field to healthSnapshots schema**

In `convex/schema.ts`, add to the healthSnapshots table: `coachInsight: v.optional(v.string())`

- [ ] **Step 2: Add getReadinessScore query to dashboard.ts**

Read `convex/dashboard.ts` and `convex/health.ts` to understand existing patterns. Add:

```typescript
export const getReadinessScore = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getEffectiveUserId(ctx);
    if (!userId) return null;

    // Get last 7 days of health snapshots
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    const cutoffStr = cutoff.toISOString().split("T")[0];

    const snapshots = await ctx.db
      .query("healthSnapshots")
      .withIndex("by_userId_date", (q) => q.eq("userId", userId).gte("date", cutoffStr))
      .collect();

    if (snapshots.length === 0) return null;

    const today = snapshots.sort((a, b) => b.date.localeCompare(a.date))[0];

    // Compute 7-day averages
    const hrvValues = snapshots.map((s) => s.hrvSDNN).filter((v): v is number => v != null);
    const rhrValues = snapshots
      .map((s) => s.restingHeartRate)
      .filter((v): v is number => v != null);
    const hrvAvg =
      hrvValues.length > 0 ? hrvValues.reduce((a, b) => a + b, 0) / hrvValues.length : null;
    const rhrAvg =
      rhrValues.length > 0 ? rhrValues.reduce((a, b) => a + b, 0) / rhrValues.length : null;

    // Get recent Tonal workouts for load calculation
    // (reuse existing workout history query pattern)

    // Compute readiness score (penalty-based)
    let score = 100;

    // HRV penalties
    if (today.hrvSDNN != null && hrvAvg != null) {
      const pctBelow = (hrvAvg - today.hrvSDNN) / hrvAvg;
      if (pctBelow > 0.2) score -= 25;
      else if (pctBelow > 0.1) score -= 15;
    }

    // Sleep penalties
    if (today.sleepDurationMinutes != null) {
      if (today.sleepDurationMinutes < 360)
        score -= 20; // < 6h
      else if (today.sleepDurationMinutes < 420) score -= 10; // < 7h
    }
    if (today.sleepDeepMinutes != null && today.sleepDeepMinutes < 45) {
      score -= 5;
    }

    // RHR penalties
    if (today.restingHeartRate != null && rhrAvg != null) {
      if (today.restingHeartRate - rhrAvg > 5) score -= 10;
    }

    // Training load penalties (check last 3 days for consecutive training)
    // ... compute from workout history

    score = Math.max(0, Math.min(100, score));
    const label = score > 70 ? "Ready" : score > 40 ? "Moderate" : "Recovery";

    return {
      score,
      label,
      factors: {
        sleep:
          today.sleepDurationMinutes != null
            ? {
                value: today.sleepDurationMinutes,
                formatted: `${Math.floor(today.sleepDurationMinutes / 60)}h ${Math.round(today.sleepDurationMinutes % 60)}m`,
                trend: "stable" as const, // compute from history
              }
            : null,
        hrv:
          today.hrvSDNN != null
            ? {
                value: today.hrvSDNN,
                formatted: `${Math.round(today.hrvSDNN)}ms`,
                trend: (hrvAvg && today.hrvSDNN < hrvAvg * 0.95
                  ? "down"
                  : today.hrvSDNN > hrvAvg! * 1.05
                    ? "up"
                    : "stable") as "up" | "down" | "stable",
              }
            : null,
        rhr:
          today.restingHeartRate != null
            ? {
                value: today.restingHeartRate,
                formatted: `${Math.round(today.restingHeartRate)} bpm`,
                trend: (rhrAvg && today.restingHeartRate > rhrAvg + 3
                  ? "up"
                  : today.restingHeartRate < rhrAvg! - 3
                    ? "down"
                    : "stable") as "up" | "down" | "stable",
              }
            : null,
        load: {
          label: "Moderate" as "Heavy" | "Moderate" | "Light", // compute from workout history
        },
      },
    };
  },
});
```

- [ ] **Step 3: Add getCoachInsight action**

```typescript
export const getCoachInsight = action({
  args: {},
  handler: async (ctx) => {
    // Check cached insight in today's healthSnapshot
    // If fresh (< 6 hours old), return cached
    // Otherwise, generate via AI and cache

    // For MVP: return a deterministic insight based on readiness data
    // Full AI generation can be added later
    return { insight: "Ask your coach about today's plan" };
  },
});
```

Start with a deterministic insight generator (no AI call) that picks the most impactful signal. This avoids the complexity of calling the AI agent from a dashboard action for MVP. Upgrade to AI-generated later.

- [ ] **Step 4: Verify and commit**

Run: `npx tsc --noEmit`
Commit: `git commit -m "feat: add readiness score query and coach insight to dashboard"`

---

## Task 2: SparklineView Component

**Files:**

- Create: `ios/TonalCoach/Shared/SparklineView.swift`

- [ ] **Step 1: Create SparklineView**

A reusable animated sparkline for 7-day trends (weight, HRV):

```swift
struct SparklineView: View {
    let values: [Double?]  // 7 values, newest last, nil = no data
    let color: Color
    var height: CGFloat = 32
    var positiveIsGood: Bool = true  // false for weight when cutting

    // Animated line draw from left to right
    // Dots at each non-nil data point
    // Color shifts based on trend direction if positiveIsGood
}
```

Key implementation:

- `Path` with line segments between non-nil points
- `.trim(from: 0, to: animatedProgress)` for draw animation
- 4pt circles at each data point
- `Animate.gentle` for the draw animation
- Skip nil values (gap in the line)

- [ ] **Step 2: Add to Xcode project, build, commit**

---

## Task 3: ReadinessCard

**Files:**

- Create: `ios/TonalCoach/Tonal/ReadinessCard.swift`
- Modify: `ios/TonalCoach/Shared/Models.swift` (add ReadinessScore type)

- [ ] **Step 1: Add ReadinessScore Decodable type**

```swift
struct ReadinessScore: Decodable {
    let score: Double
    let label: String
    struct Factor: Decodable {
        let value: Double?
        let formatted: String?
        let trend: String?  // "up", "down", "stable"
        let label: String?  // for load factor
    }
    struct Factors: Decodable {
        let sleep: Factor?
        let hrv: Factor?
        let rhr: Factor?
        let load: Factor?
    }
    let factors: Factors
}
```

- [ ] **Step 2: Create ReadinessCard**

Hero card with:

- Large ScoreRing (96pt) with readiness score, animated fill
- CountingText for the number
- Label below ring: "Ready" / "Moderate" / "Recovery" with semantic color
- 4 factor pills in a horizontal row below
- Each pill: icon + value + trend arrow (SF Symbols: arrow.up.right / arrow.down.right / arrow.right)

- [ ] **Step 3: Build, commit**

---

## Task 4: SleepCard

**Files:**

- Create: `ios/TonalCoach/Tonal/SleepCard.swift`

- [ ] **Step 1: Create SleepCard**

Reads from healthSnapshots (passed as prop, not fetched internally):

- Large duration text with quality label
- Horizontal stacked bar for sleep stages (GeometryReader for proportional widths)
- Bed/wake times
- 7-day mini bar chart (tiny vertical bars, today highlighted with glow)

- [ ] **Step 2: Build, commit**

---

## Task 5: TrainingLoadCard

**Files:**

- Create: `ios/TonalCoach/Tonal/TrainingLoadCard.swift`

- [ ] **Step 1: Create TrainingLoadCard**

Takes combined workout list (Tonal + external):

- 7 day circles in HStack (Mon-Sun)
- Each circle: filled proportionally to minutes trained
- Tonal workouts in primary color, non-Tonal in muted
- Today's circle with todayGlow()
- Summary stats below: session count, total time, Tonal vs other split
- Load trend label

- [ ] **Step 2: Build, commit**

---

## Task 6: BodyHeartCard + CoachInsightBanner

**Files:**

- Create: `ios/TonalCoach/Tonal/BodyHeartCard.swift`
- Create: `ios/TonalCoach/Tonal/CoachInsightBanner.swift`

- [ ] **Step 1: Create BodyHeartCard**

2-column layout:

- Left: Weight value + SparklineView + delta text
- Right: HRV value + SparklineView + delta text
- Below: RHR value + trend arrow + "vs avg" text

- [ ] **Step 2: Create CoachInsightBanner**

Replaces the coach CTA:

- Sparkles icon + insight text
- Falls back to "Ask your coach about today's plan"
- Tappable, navigates to Chat

- [ ] **Step 3: Build, commit**

---

## Task 7: StrengthScoreCard Compact Mode

**Files:**

- Modify: `ios/TonalCoach/Tonal/StrengthScoreCard.swift`

- [ ] **Step 1: Add compact variant**

Add a `compact: Bool = false` parameter. When compact:

- Single row: 48pt ring + inline "Upper 320 | Lower 280 | Core 180" text
- No region rings
- "View in Tonal" link at trailing edge

- [ ] **Step 2: Build, commit**

---

## Task 8: Rewire Dashboard Layout

**Files:**

- Modify: `ios/TonalCoach/Tonal/TonalDashboardView.swift`
- Modify: `ios/TonalCoach/App/ContentView.swift`

- [ ] **Step 1: Replace TonalDashboardView layout**

Replace the 5 old AsyncCards with the new layout:

```swift
ScrollView {
    VStack(spacing: Theme.Spacing.lg) {
        // Greeting (keep existing)
        greetingHeader.staggeredAppear(index: 0)

        // Coach Insight (replaces CTA)
        AsyncCard(title: nil) { ... getCoachInsight ... } content: { data in
            CoachInsightBanner(insight: data.insight, selectedTab: $selectedTab)
        }
        .staggeredAppear(index: 1)

        // Readiness Ring (hero)
        AsyncCard(title: "Readiness") { ... getReadinessScore ... } content: { data in
            ReadinessCard(readiness: data)
        }
        .staggeredAppear(index: 2)

        // Sleep
        AsyncCard(title: "Sleep") { ... getRecentSnapshots(days: 7) ... } content: { snapshots in
            SleepCard(snapshots: snapshots)
        }
        .staggeredAppear(index: 3)

        // Training Load
        AsyncCard(title: "Training Load") { ... getWorkoutHistory + getExternalActivities ... } content: { data in
            TrainingLoadCard(workouts: data)
        }
        .staggeredAppear(index: 4)

        // Body & Heart
        AsyncCard(title: "Body & Heart") { ... getRecentSnapshots ... } content: { snapshots in
            BodyHeartCard(snapshots: snapshots)
        }
        .staggeredAppear(index: 5)

        // Strength (compact)
        AsyncCard(title: "Strength") { ... getStrengthData ... } content: { data in
            StrengthScoreCard(data: data, compact: true)
        }
        .staggeredAppear(index: 6)
    }
}
```

Each card uses AsyncCard's existing loading/error/content pattern. Cards with no data won't render (AsyncCard handles this).

- [ ] **Step 2: Update ContentView DashboardRouter**

Remove the Tonal/Health dashboard split. Always show the unified dashboard. The dashboard handles its own graceful degradation (cards omit themselves when data is missing).

```swift
// Replace the routing logic:
// OLD: if hasTonalProfile { TonalDashboardView } else { HealthDashboardView }
// NEW: always TonalDashboardView (now the unified dashboard)
```

Keep HealthDashboardView in the codebase for now but stop routing to it.

- [ ] **Step 3: Build and verify**

Run: iOS build + manual verification
Verify: Dashboard shows new layout with whatever data is available

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(ios): unified dashboard with readiness ring, sleep, training load, and body/heart cards"
```

---

## Task 9: Final Verification + Push

- [ ] **Step 1: Full build**

Backend: `npx tsc --noEmit`
iOS: `xcodebuild -scheme TonalCoach ...`

- [ ] **Step 2: Commit and push**

```bash
git push origin main
```
