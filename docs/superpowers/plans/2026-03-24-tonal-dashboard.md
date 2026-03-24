# Tonal Connection + Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Tonal account connection and real-time dashboard (strength scores, muscle readiness, workout history) to the iOS app by calling existing Convex backend actions.

**Architecture:** iOS calls existing Convex actions (`tonal/connectPublic:connectTonal`, `dashboard:get*`, `users:getMe`) via `ConvexManager.action()`. No backend changes. Dashboard shows 5 data cards in parallel with per-card loading/error states. Tonal tokens are managed entirely server-side.

**Tech Stack:** SwiftUI, ConvexMobile, Swift Charts (for training frequency), iOS 17+

**Spec:** `docs/superpowers/specs/2026-03-24-tonal-dashboard-design.md`

---

## File Map

### Create

| File                                                | Responsibility                                     |
| --------------------------------------------------- | -------------------------------------------------- |
| `ios/TonalCoach/Tonal/TonalModels.swift`            | Decodable types matching Convex response shapes    |
| `ios/TonalCoach/Tonal/AsyncCard.swift`              | Reusable loading/error/content card wrapper        |
| `ios/TonalCoach/Tonal/ConnectTonalView.swift`       | Tonal credentials form (email + password)          |
| `ios/TonalCoach/Tonal/TonalDashboardView.swift`     | Main dashboard orchestrating 5 parallel data loads |
| `ios/TonalCoach/Tonal/StrengthScoreCard.swift`      | 4 circular progress rings + percentile             |
| `ios/TonalCoach/Tonal/MuscleReadinessCard.swift`    | Color-coded muscle group grid                      |
| `ios/TonalCoach/Tonal/RecentWorkoutsCard.swift`     | Last 5 workout rows                                |
| `ios/TonalCoach/Tonal/TrainingFrequencyCard.swift`  | Horizontal bar chart (Swift Charts)                |
| `ios/TonalCoach/Tonal/ExternalActivitiesCard.swift` | Non-Tonal activity rows                            |

### Modify

| File                                       | Change                                               |
| ------------------------------------------ | ---------------------------------------------------- |
| `ios/TonalCoach/App/ContentView.swift`     | Dashboard tab: show TonalDashboard or connect prompt |
| `ios/TonalCoach/Profile/ProfileView.swift` | Add "Connect Tonal" / "Tonal Connected" row          |

---

## Task 1: TonalModels

**Files:**

- Create: `ios/TonalCoach/Tonal/TonalModels.swift`

- [ ] **Step 1: Create Decodable types**

All types match the exact shapes returned by Convex actions. Key reference: `convex/tonal/types.ts` and `convex/dashboard.ts`.

Important: Convex `v.number()` fields arrive as plain JSON numbers (not `$integer`). Use `@ConvexNumber` for safety (from Models.swift).

```swift
// UserInfo - from users:getMe query
struct UserInfo: Decodable {
    let userId: String
    let email: String?
    let hasTonalProfile: Bool
    let onboardingCompleted: Bool
    let tonalName: String?
    let tonalEmail: String?
    let tonalTokenExpired: Bool
}

// ConnectResult - from tonal/connectPublic:connectTonal action
struct ConnectTonalResult: Decodable {
    let success: Bool
    let tonalUserId: String
}

// StrengthData - from dashboard:getStrengthData action
struct StrengthData: Decodable {
    let scores: [StrengthScore]
    let distribution: StrengthDistribution
}

struct StrengthScore: Decodable, Identifiable {
    let id: String
    let userId: String
    let strengthBodyRegion: String
    let bodyRegionDisplay: String
    let score: Double
    let current: Bool
}

struct StrengthDistribution: Decodable {
    let userId: String
    let overallScore: Double
    let percentile: Double
    let distributionPoints: [DistributionPoint]?
}

struct DistributionPoint: Decodable {
    let score: Double
    let yValue: Double
}

// MuscleReadiness - from dashboard:getMuscleReadiness action
struct MuscleReadiness: Decodable {
    let Chest: Double
    let Shoulders: Double
    let Back: Double
    let Triceps: Double
    let Biceps: Double
    let Abs: Double
    let Obliques: Double
    let Quads: Double
    let Glutes: Double
    let Hamstrings: Double
    let Calves: Double

    var sorted: [(name: String, value: Double)] {
        [
            ("Chest", Chest), ("Shoulders", Shoulders), ("Back", Back),
            ("Triceps", Triceps), ("Biceps", Biceps), ("Abs", Abs),
            ("Obliques", Obliques), ("Quads", Quads), ("Glutes", Glutes),
            ("Hamstrings", Hamstrings), ("Calves", Calves),
        ].sorted { $0.value > $1.value }
    }
}

// Activity - from dashboard:getWorkoutHistory action
struct TonalActivity: Decodable, Identifiable {
    let activityId: String
    let activityTime: String
    let activityType: String
    let workoutPreview: WorkoutPreview
    var id: String { activityId }
}

struct WorkoutPreview: Decodable {
    let workoutTitle: String
    let targetArea: String
    let totalDuration: Double
    let totalVolume: Double
    let totalAchievements: Double
    let programName: String?
    let coachName: String?
    let level: String?
}

// TrainingFrequencyEntry - from dashboard:getTrainingFrequency action
struct TrainingFrequencyEntry: Decodable, Identifiable {
    let targetArea: String
    let count: Int
    let lastTrainedDate: String
    var id: String { targetArea }
}

// ExternalActivity - from dashboard:getExternalActivities action
struct TonalExternalActivity: Decodable, Identifiable {
    let id: String
    let workoutType: String
    let beginTime: String
    let activeDuration: Double
    let activeCalories: Double
    let averageHeartRate: Double
    let source: String
}
```

- [ ] **Step 2: Build**
- [ ] **Step 3: Commit**

```bash
git add ios/TonalCoach/Tonal/TonalModels.swift
git commit -m "feat(tonal-dash): add Decodable types for Tonal API responses"
```

---

## Task 2: AsyncCard

**Files:**

- Create: `ios/TonalCoach/Tonal/AsyncCard.swift`

- [ ] **Step 1: Create reusable async loading card**

A generic view that manages loading/error/content states for dashboard sections. Uses `@Observable` view model pattern.

Key design:

- Takes a `title: String`, `load: () async throws -> T` closure, and `@ViewBuilder content: (T) -> Content`
- Shows skeleton while loading, error+retry on failure, content on success
- Each card loads independently (one failure doesn't block others)
- Matches Theme.Colors card styling

- [ ] **Step 2: Build**
- [ ] **Step 3: Commit**

```bash
git add ios/TonalCoach/Tonal/AsyncCard.swift
git commit -m "feat(tonal-dash): add AsyncCard reusable loading wrapper"
```

---

## Task 3: ConnectTonalView (use design-engineer agent)

**Files:**

- Create: `ios/TonalCoach/Tonal/ConnectTonalView.swift`

**Dispatch to design-engineer** with this brief:

- Read: `ios/TonalCoach/Auth/LoginView.swift` (visual reference - match the form style)
- Read: `ios/TonalCoach/Shared/Theme.swift` (design tokens)
- Read: `src/app/onboarding/ConnectStep.tsx` (web reference)
- Tonal-branded header: dumbbell.fill icon + "Connect Your Tonal" title
- Subtitle: "Sign in with your Tonal account credentials to see strength scores, muscle readiness, and workout history"
- Email TextField + Password SecureField (same styling as LoginView)
- "Connect" primary button (full width, loading spinner)
- Error banner (same pattern as LoginView)
- Note: "These are your Tonal credentials, not your tonal.coach account"
- Presented as `.sheet` - include dismiss button (X in top-right)
- Calls: `convexManager.action("tonal/connectPublic:connectTonal", with: ["tonalEmail": email, "tonalPassword": password])`
- Decodes: `ConnectTonalResult`
- On success: dismiss sheet, haptic success
- `@Environment(ConvexManager.self)` for action calls
- `@Environment(\.dismiss)` for sheet dismissal

- [ ] **Step 1: Create ConnectTonalView**
- [ ] **Step 2: Build**
- [ ] **Step 3: Commit**

```bash
git add ios/TonalCoach/Tonal/ConnectTonalView.swift
git commit -m "feat(tonal-dash): add ConnectTonalView credentials form"
```

---

## Task 4: Dashboard data cards (dispatch 5 agents in parallel)

**Files:**

- Create: `ios/TonalCoach/Tonal/StrengthScoreCard.swift`
- Create: `ios/TonalCoach/Tonal/MuscleReadinessCard.swift`
- Create: `ios/TonalCoach/Tonal/RecentWorkoutsCard.swift`
- Create: `ios/TonalCoach/Tonal/TrainingFrequencyCard.swift`
- Create: `ios/TonalCoach/Tonal/ExternalActivitiesCard.swift`

**Dispatch 5 design-engineer agents in parallel**, each creating one card:

**All agents should read:**

- `ios/TonalCoach/Shared/Theme.swift` (design tokens)
- `ios/TonalCoach/Tonal/TonalModels.swift` (data types)
- `ios/TonalCoach/Tonal/AsyncCard.swift` (wrapper pattern)

**Agent 4a: StrengthScoreCard**

- Large "Overall" circular progress ring (center) with score inside
- 3 smaller rings in a row: Upper, Lower, Core
- Ring colors: Theme.Colors.primary fill, Theme.Colors.border track
- Percentile badge below: "Top X%" (invert percentile: 100 - distribution.percentile)
- Data type: `StrengthData`

**Agent 4b: MuscleReadinessCard**

- 2-column LazyVGrid of 11 muscles
- Each cell: muscle name + readiness % + small colored circle
- Colors: green (>80%), amber (60-80%), red (<60%) matching Theme.Colors.success/warning/error
- Data type: `MuscleReadiness` (use `.sorted` computed property)

**Agent 4c: RecentWorkoutsCard**

- VStack of up to 5 `WorkoutRow` views
- Each row: title (semibold), target area badge, then stats row: volume (lbs), duration (min), PRs
- Left accent bar using `Theme.Colors.sessionTypeColor` for target area
- Relative time label (use `RelativeDateTimeFormatter`)
- Data type: `[TonalActivity]`

**Agent 4d: TrainingFrequencyCard**

- Uses Swift Charts `BarMark` (horizontal bars)
- `import Charts`
- Y axis: `.value("Area", entry.targetArea)`
- X axis: `.value("Count", entry.count)`
- Bar colors: rotating palette from Theme.Colors.chart1-5
- Data type: `[TrainingFrequencyEntry]`

**Agent 4e: ExternalActivitiesCard**

- VStack of activity rows (up to 5)
- Each row: workout type icon (SF Symbol mapping), duration, calories if > 0, HR if > 0, source badge
- Relative time
- Data type: `[TonalExternalActivity]`

- [ ] **Step 1: Dispatch all 5 agents**
- [ ] **Step 2: Build after all complete**
- [ ] **Step 3: Commit**

```bash
git add ios/TonalCoach/Tonal/StrengthScoreCard.swift ios/TonalCoach/Tonal/MuscleReadinessCard.swift ios/TonalCoach/Tonal/RecentWorkoutsCard.swift ios/TonalCoach/Tonal/TrainingFrequencyCard.swift ios/TonalCoach/Tonal/ExternalActivitiesCard.swift
git commit -m "feat(tonal-dash): add 5 dashboard data cards"
```

---

## Task 5: TonalDashboardView

**Files:**

- Create: `ios/TonalCoach/Tonal/TonalDashboardView.swift`

- [ ] **Step 1: Create main dashboard view**

Orchestrates all 5 data cards. Fires 5 parallel Convex action calls on appear.

Key design:

- `@Environment(ConvexManager.self)` for action calls
- `@State` properties for each data section (optional, loaded async)
- `.task` fires all 5 loads concurrently using `TaskGroup` or individual `Task {}`
- ScrollView with VStack of AsyncCard-wrapped sections
- Pull-to-refresh reloads all data
- Each action: `convexManager.action("dashboard:getStrengthData", with: [:])` etc.
- Note: all dashboard actions take no args (they resolve userId server-side from auth)

- [ ] **Step 2: Build**
- [ ] **Step 3: Commit**

```bash
git add ios/TonalCoach/Tonal/TonalDashboardView.swift
git commit -m "feat(tonal-dash): add TonalDashboardView orchestrating 5 data sections"
```

---

## Task 6: Wire Dashboard tab

**Files:**

- Modify: `ios/TonalCoach/App/ContentView.swift`

- [ ] **Step 1: Update Dashboard tab logic**

Replace the current `HealthDashboardView()` in the Dashboard tab with:

```swift
// In the Dashboard tab:
NavigationStack {
    DashboardRouter()
        .navigationTitle("Dashboard")
        .navigationBarTitleDisplayMode(.large)
}
```

Create a `DashboardRouter` view (can be in the same file or ContentView):

- Subscribe to `users:getMe` query to get `hasTonalProfile` and `tonalTokenExpired`
- If `hasTonalProfile && !tonalTokenExpired`: show `TonalDashboardView()`
- If `hasTonalProfile && tonalTokenExpired`: show reconnect card + `HealthDashboardView()`
- If `!hasTonalProfile`: show connect prompt card + `HealthDashboardView()`
- Connect prompt card: teal border card with "Connect Your Tonal" + "Connect" button
- Button presents `ConnectTonalView` as `.sheet`
- After connection: `hasTonalProfile` becomes true (reactive via subscription), dashboard auto-switches

For `users:getMe` subscription, use the Combine sink pattern (matching LibraryHomeView):

```swift
convex.client.subscribe(to: "users:getMe", yielding: UserInfo.self)
    .replaceError(with: nil)
    .receive(on: DispatchQueue.main)
    .sink { ... }
```

- [ ] **Step 2: Build**
- [ ] **Step 3: Commit**

```bash
git add ios/TonalCoach/App/ContentView.swift
git commit -m "feat(tonal-dash): wire dashboard tab with Tonal/HealthKit routing"
```

---

## Task 7: Update ProfileView

**Files:**

- Modify: `ios/TonalCoach/Profile/ProfileView.swift`

- [ ] **Step 1: Add Tonal connection row**

Add a "Tonal" section between Account and Health:

- If connected (`hasTonalProfile`): show "Tonal" row with checkmark + tonalName, "Connected" subtitle
- If not connected: show "Connect Tonal" button (presents ConnectTonalView sheet)
- If token expired: show "Reconnect Tonal" button (orange warning color)

Subscribe to `users:getMe` same as Dashboard tab (or pass UserInfo down via environment).

- [ ] **Step 2: Build**
- [ ] **Step 3: Commit**

```bash
git add ios/TonalCoach/Profile/ProfileView.swift
git commit -m "feat(tonal-dash): add Tonal connection status to ProfileView"
```

---

## Task 8: Integration build and test

- [ ] **Step 1: Regenerate Xcode project and full build**

```bash
cd ios && xcodegen generate
xcodebuild -project TonalCoach.xcodeproj -scheme TonalCoach \
  -destination 'platform=iOS Simulator,id=081A8F9C-DEBB-4AF8-A6DF-6D5BD3C264DC' \
  -configuration Debug build
```

- [ ] **Step 2: Manual test checklist**

- [ ] Dashboard shows "Connect Tonal" card when not connected
- [ ] Tapping Connect opens ConnectTonalView sheet
- [ ] Entering valid Tonal credentials -> success, sheet dismisses
- [ ] Dashboard auto-switches to TonalDashboardView with real data
- [ ] Strength scores show 4 rings with scores
- [ ] Muscle readiness shows color-coded grid
- [ ] Recent workouts show up to 5 entries
- [ ] Training frequency chart renders bars
- [ ] Pull-to-refresh reloads data
- [ ] Profile shows "Tonal Connected" with name
- [ ] Wrong Tonal credentials -> error message in sheet

- [ ] **Step 3: Push and create PR**

```bash
git push -u origin feat/tonal-dashboard
gh pr create --title "feat: Tonal connection + dashboard" --body "..."
```
