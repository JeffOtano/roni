# Unified Dashboard Redesign - Design Spec

**Date:** 2026-03-26
**Goal:** Redesign the iOS dashboard to synthesize Tonal training data with Apple Health recovery data into a holistic view that neither app provides alone. The dashboard answers one question: "How ready am I to train today?"

---

## Thesis

Tonal knows your training but not your sleep. Apple Health knows your sleep but not your training. TonalCoach is the only app that combines both to give a complete picture of readiness, load, and recovery. The dashboard should make this synthesis visible and actionable.

---

## 1. Layout (Top to Bottom)

### Greeting + Coach Insight

- "Good morning, Jeff" with date (keep existing)
- Replace the coach CTA banner with an **AI-generated insight line**: a single sentence synthesizing the most important signal from today's data
- Examples: "HRV trending down after 3 hard days - consider a lighter session" / "Great sleep and rising HRV - good day to push intensity" / "You ran 5 miles yesterday, your legs might need recovery"
- Tappable - navigates to Chat tab to ask follow-up
- Falls back to the generic "Ask your coach about today's plan" if no health data available

### Readiness Ring (Hero Card)

- **0-100 score** in a large animated ring (96pt, reusing the `ScoreRing` component)
- Score label: "Ready" (>70, green), "Moderate" (40-70, amber), "Recovery" (<40, rose)
- Below the ring: 4 contributing factor pills showing what drove the score:
  - Sleep: "7h 12m" with up/down/stable icon
  - HRV: "48ms" with trend icon
  - RHR: "58 bpm" with trend icon
  - Load: "Heavy" / "Moderate" / "Light" based on last 3 days training volume
- Each pill tappable to scroll to its detail card below

**Readiness score calculation (simple, transparent):**

```
Start at 100, subtract penalties:
- HRV > 10% below 7-day avg: -15
- HRV > 20% below avg: -25 (replaces -15)
- Sleep < 7h: -10
- Sleep < 6h: -20 (replaces -10)
- Deep sleep < 45min: -5
- RHR > 5 bpm above 7-day avg: -10
- Tonal workout yesterday > 45 min: -5
- Tonal workout yesterday > 60 min: -10 (replaces -5)
- 3+ consecutive training days: -10
- No data for a metric: skip that penalty (don't penalize missing data)
Floor at 0, cap at 100.
```

This is intentionally simple and explainable. Not a black box. If users ask the coach "why is my readiness 65?", the coach can point to specific factors.

### Sleep Card

- **Last night's sleep** as the headline: "6h 52m" in large text with quality label
- Quality labels: "Excellent" (>8h + >1h deep), "Good" (7-8h), "Fair" (6-7h), "Poor" (<6h)
- Sleep stage breakdown as a horizontal stacked bar: deep (purple), REM (blue), core (teal), awake (gray)
- Bed time and wake time: "11:15 PM - 6:07 AM"
- 7-day mini trend: tiny bar chart showing sleep duration for last 7 nights, today highlighted
- If no sleep data: "Connect Apple Watch for sleep tracking" with a subtle prompt

### Training Load Card

- **7-day timeline** as a horizontal row of day circles (Mon-Sun)
- Each circle filled proportionally to that day's training volume (total minutes)
- Color: Tonal workouts in primary (teal), non-Tonal in secondary (muted)
- Today's circle highlighted (glow effect reuse)
- Below timeline: summary stats
  - "4 sessions this week | 3h 15m total | 2 Tonal, 2 other"
  - Load trend: "Increasing" / "Steady" / "Decreasing" vs prior week
- Tappable days expand to show workout details inline (name, duration, type)
- Sources: Tonal workout history + external activities (both already available via existing Convex queries)

### Body & Heart Card

- Compact 2-column layout:
  - Left: **Weight** - current value + 7-day sparkline trend + delta
  - Right: **HRV** - current value + 7-day sparkline trend + delta
- Below: **RHR** - current value + 7-day trend arrow + "vs avg" label
- All values from `healthSnapshots` table
- If no body data: show only heart metrics. If no heart data: show only body. If neither: omit card entirely.

### Strength Summary (Compact)

- **Demoted from hero to supporting card**
- Single row: overall score ring (48pt, small) + "Upper 320 | Lower 280 | Core 180" inline text
- No region rings displayed - just the numbers
- Tappable to expand or "View in Tonal" deep link
- If no Tonal account: omit this card entirely

---

## 2. Data Sources

| Card           | Tonal Data                                       | Health Data          | Convex Query                                                                |
| -------------- | ------------------------------------------------ | -------------------- | --------------------------------------------------------------------------- |
| Coach Insight  | Training schedule, recent workouts               | Sleep, HRV, RHR      | New: `dashboard:getCoachInsight` action (calls AI)                          |
| Readiness Ring | Recent workout volume, consecutive training days | HRV, sleep, RHR      | New: `dashboard:getReadinessScore` query (computed)                         |
| Sleep          | -                                                | sleepAnalysis stages | Existing: `health:getRecentSnapshots`                                       |
| Training Load  | Tonal workouts + external activities             | -                    | Existing: `dashboard:getWorkoutHistory` + `dashboard:getExternalActivities` |
| Body & Heart   | -                                                | weight, HRV, RHR     | Existing: `health:getRecentSnapshots`                                       |
| Strength       | Strength scores                                  | -                    | Existing: `dashboard:getStrengthData`                                       |

### New Backend Functions

**`dashboard:getReadinessScore`** (query):

- Reads last 7 days of `healthSnapshots` + recent Tonal workout history
- Computes the readiness score using the penalty formula above
- Returns: `{ score: number, label: string, factors: { sleep: {...}, hrv: {...}, rhr: {...}, load: {...} } }`
- Pure computation, no external API calls

**`dashboard:getCoachInsight`** (action):

- Calls the AI agent with a focused prompt: "Generate a single sentence coaching insight for the dashboard based on this data: [readiness score, sleep, HRV trend, recent workouts]"
- Returns: `{ insight: string }`
- Cached per user per day to avoid redundant AI calls (store in `healthSnapshots.coachInsight` field)
- Falls back to generic insight if AI call fails

---

## 3. What Gets Removed

| Current Card             | Disposition                                                                                              |
| ------------------------ | -------------------------------------------------------------------------------------------------------- |
| Muscle Readiness Heatmap | **Removed.** Tonal-specific data, available in Tonal app. The readiness ring replaces this conceptually. |
| Training Frequency Bars  | **Removed.** Folded into Training Load timeline which shows volume per day more intuitively.             |
| External Activities List | **Removed.** Folded into Training Load card alongside Tonal workouts.                                    |
| Coach CTA Banner         | **Replaced** by Coach Insight line (tappable, same navigation).                                          |

The removed components (`MuscleReadinessCard`, `TrainingFrequencyCard`, `ExternalActivitiesCard`) stay in the codebase - they're still used by the AI context builder. Just no longer rendered on the dashboard.

---

## 4. Graceful Degradation

The dashboard must work for every user state:

| State                          | What Shows                                                                                                        |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Tonal + Apple Watch            | Full dashboard (all cards)                                                                                        |
| Tonal + iPhone only (no Watch) | Readiness ring (load-only, no HRV/sleep), Training Load, Strength. Sleep/Heart cards omitted.                     |
| No Tonal + Apple Watch         | Readiness ring (health-only), Sleep, Body & Heart. Training Load shows only non-Tonal workouts. Strength omitted. |
| No Tonal + iPhone only         | Minimal: steps, weight if tracked. Prompt to connect Tonal and/or Apple Watch.                                    |
| Guest mode                     | Library only (no dashboard, existing behavior)                                                                    |

Each card independently checks if it has data. No card shows "No data" - it simply doesn't appear.

---

## 5. UI Treatment

All cards use the premium polish foundation from the earlier spec:

- `.cardStyle()` with shadow
- `.staggeredAppear(index:)` for cascade reveal
- `.pressableCard()` on tappable cards
- `CountingText` for animated numbers
- `Animate.gentle` for ring fills and sparkline draws
- Dark theme with the existing OKLch color tokens

**Readiness ring colors:**

- Score > 70: `Theme.Colors.primary` (teal/cyan) - "Ready"
- Score 40-70: `Theme.Colors.chart5` (amber) - "Moderate"
- Score < 40: `Theme.Colors.chart4` (rose) - "Recovery"
  (Same thresholds as strength score rings for consistency)

**Sleep stage bar colors:**

- Deep: `Color(hex: "#7c3aed")` (purple)
- REM: `Color(hex: "#3b82f6")` (blue)
- Core: `Theme.Colors.primary` (teal)
- Awake: `Theme.Colors.muted` (gray)

**Sparkline style (weight, HRV trends):**

- Thin line (2pt) with dots at each data point (4pt)
- Color: `Theme.Colors.primary` for positive trend, `Theme.Colors.chart4` for negative
- 7 data points, width fills available space
- Animated draw from left to right on appear

---

## 6. Implementation Scope

### New iOS Files

| File                                            | What                                         |
| ----------------------------------------------- | -------------------------------------------- |
| `ios/TonalCoach/Tonal/ReadinessCard.swift`      | Hero readiness ring + factor pills           |
| `ios/TonalCoach/Tonal/SleepCard.swift`          | Sleep summary + stage bar + 7-day mini chart |
| `ios/TonalCoach/Tonal/TrainingLoadCard.swift`   | 7-day timeline + workout summary             |
| `ios/TonalCoach/Tonal/BodyHeartCard.swift`      | Weight + HRV + RHR with sparklines           |
| `ios/TonalCoach/Shared/SparklineView.swift`     | Reusable 7-day trend sparkline component     |
| `ios/TonalCoach/Tonal/CoachInsightBanner.swift` | AI-generated insight line                    |

### Modified iOS Files

| File                                            | Changes                                                                             |
| ----------------------------------------------- | ----------------------------------------------------------------------------------- |
| `ios/TonalCoach/Tonal/TonalDashboardView.swift` | Replace card layout with new structure                                              |
| `ios/TonalCoach/Tonal/StrengthScoreCard.swift`  | Add compact variant for demoted display                                             |
| `ios/TonalCoach/App/ContentView.swift`          | Update DashboardRouter to always show unified dashboard (remove Tonal/Health split) |

### New Convex Files

| File                  | Changes                                                      |
| --------------------- | ------------------------------------------------------------ |
| `convex/dashboard.ts` | Add `getReadinessScore` query and `getCoachInsight` action   |
| `convex/schema.ts`    | Add `coachInsight` optional field to `healthSnapshots` table |

### Modified Convex Files

| File               | Changes                                               |
| ------------------ | ----------------------------------------------------- |
| `convex/health.ts` | Add `coachInsight` to syncSnapshot args (for caching) |

---

## 7. Design Principles

1. **Synthesis over duplication.** Every card shows something neither Tonal nor Apple Health shows alone.
2. **Glanceable.** The readiness ring answers "should I train?" in under 1 second.
3. **Transparent.** The readiness score is explainable - users can see what drives it.
4. **Progressive.** More data = richer dashboard. Missing data = fewer cards, not broken cards.
5. **Actionable.** Every insight connects to the coach. Tap anything to ask more.
