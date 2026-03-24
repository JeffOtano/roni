# Tonal Connection + Dashboard - Design Spec

## Overview

Add Tonal account connection and a data-rich dashboard to the iOS app, calling existing Convex backend actions. Users connect their Tonal credentials (Auth0 password-realm exchange), then see strength scores, muscle readiness, workout history, training frequency, and external activities - the same data the web dashboard shows.

## Goals

- Users can connect their Tonal account from the iOS app
- Dashboard shows real Tonal data (strength, readiness, history) when connected
- HealthKit dashboard remains available as a secondary data source
- Connection prompt is non-blocking (app works without Tonal connected)
- All data loads in parallel with per-card loading/error states

## Architecture

### No Backend Changes

All Convex actions already exist. The iOS app calls them directly:

| Action                             | Returns                                                  |
| ---------------------------------- | -------------------------------------------------------- |
| `tonal/connectPublic:connectTonal` | Exchanges credentials via Auth0, stores encrypted tokens |
| `dashboard:getStrengthData`        | Strength scores (4 regions) + distribution/percentile    |
| `dashboard:getMuscleReadiness`     | 11 muscle groups with recovery %                         |
| `dashboard:getWorkoutHistory`      | Last 5 Tonal workouts with volume/duration/PRs           |
| `dashboard:getTrainingFrequency`   | Workout count by target area (30 days)                   |
| `dashboard:getExternalActivities`  | Non-Tonal activities (Apple Watch, etc.)                 |
| `users:getMe`                      | `hasTonalProfile`, `tonalTokenExpired` flags             |

### Data Flow

```
1. User taps "Connect Tonal" on Dashboard or Profile
2. ConnectTonalView: email + password form
3. action("tonal/connectPublic:connectTonal", { email, password })
4. Backend: Auth0 token exchange -> encrypt -> store in userProfiles
5. users.getMe now returns hasTonalProfile: true
6. Dashboard detects connection, fires 5 parallel actions
7. Each action: check cache -> fetch from Tonal API if stale -> return data
```

### Token Lifecycle

Tokens are managed entirely server-side (encrypted in Convex). The iOS app never sees or stores Tonal tokens. If tokens expire, `users.getMe` returns `tonalTokenExpired: true` and the app shows a reconnect prompt.

## Components

### Swift Files to Create

| File                                 | Purpose                                     |
| ------------------------------------ | ------------------------------------------- |
| `Tonal/ConnectTonalView.swift`       | Tonal credentials form (email + password)   |
| `Tonal/TonalDashboardView.swift`     | Main dashboard with 5 data sections         |
| `Tonal/StrengthScoreCard.swift`      | 4 circular progress rings + percentile      |
| `Tonal/MuscleReadinessCard.swift`    | Color-coded muscle group grid               |
| `Tonal/RecentWorkoutsCard.swift`     | Last 5 workout rows                         |
| `Tonal/TrainingFrequencyCard.swift`  | Horizontal bar chart                        |
| `Tonal/ExternalActivitiesCard.swift` | Non-Tonal activity rows                     |
| `Tonal/AsyncCard.swift`              | Reusable loading/error/content wrapper      |
| `Tonal/TonalModels.swift`            | Decodable types for all Tonal API responses |

### Swift Files to Modify

| File                        | Change                                          |
| --------------------------- | ----------------------------------------------- |
| `App/ContentView.swift`     | Dashboard tab logic: connected vs not connected |
| `Profile/ProfileView.swift` | Add "Connect Tonal" row                         |

## Screen Designs

### ConnectTonalView

- Dark background, same visual language as LoginView
- Tonal-branded header (could use a simple "Tonal" text or dumbbell icon)
- "Connect your Tonal account" title
- "See your strength scores, muscle readiness, and workout history" subtitle
- Email TextField
- Password SecureField
- "Connect" primary button (full width, loading state)
- Error banner (wrong credentials, network error, already connected)
- Presented as a sheet from Dashboard or Profile

### Dashboard Tab (ContentView)

```
if hasTonalProfile && !tonalTokenExpired:
    TonalDashboardView()        // Full Tonal data
elif hasTonalProfile && tonalTokenExpired:
    ReconnectPromptCard()       // "Session expired, reconnect"
    HealthDashboardView()       // Fallback to HealthKit
else:
    ConnectTonalPromptCard()    // "Connect to see your data"
    HealthDashboardView()       // HealthKit data still visible
```

### ConnectTonalPromptCard (inline on Dashboard)

- Card with teal accent border
- Dumbbell icon + "Connect Your Tonal"
- "See strength scores, muscle readiness, and workout history"
- "Connect" button (presents ConnectTonalView as sheet)

### TonalDashboardView

ScrollView with 5 sections, each wrapped in AsyncCard:

**1. Strength Scores**

- Large "Overall" circular progress ring (center, prominent)
- 3 smaller rings below: Upper, Lower, Core
- Score number inside each ring
- Percentile badge: "Top X%"
- Ring colors: teal for filled, muted for track

**2. Muscle Readiness**

- 2-column grid of 11 muscle groups
- Each cell: muscle name + readiness % + colored indicator
- Colors: green (>80% ready), amber (60-80%), red (<60%)
- Section title: "Muscle Readiness"

**3. Recent Workouts**

- Up to 5 rows
- Each row: workout title, target area badge, volume (lbs), duration, PR count
- Session type color accent on left edge
- Relative time ("2h ago", "yesterday")
- Tap navigates to workout detail (future)

**4. Training Frequency**

- Horizontal bar chart (last 30 days)
- Bars colored with rotating palette
- Y-axis: target area names
- X-axis: workout count
- Section title: "Training Frequency (30 days)"

**5. External Activities**

- Up to 5 rows
- Each row: activity type, duration, calories (if > 0), avg HR (if > 0), source
- Relative time

### AsyncCard Pattern

Reusable wrapper for each dashboard section:

```swift
AsyncCard(title: "Strength Scores") {
    // Trigger load
} content: { data in
    StrengthScoreContent(data: data)
} loading: {
    SkeletonView()
} error: { error, retry in
    ErrorView(message: error, onRetry: retry)
}
```

States: loading (skeleton), loaded (content), error (message + retry button)

## Data Types (TonalModels.swift)

```swift
struct StrengthData: Decodable {
    let scores: [StrengthScore]
    let distribution: StrengthDistribution?
}

struct StrengthScore: Decodable, Identifiable {
    let id: String
    let strengthBodyRegion: String
    let bodyRegionDisplay: String
    let score: Double
    let current: Bool
}

struct StrengthDistribution: Decodable {
    let overallScore: Double
    let percentile: Double
}

struct MuscleReadiness: Decodable {
    // 11 muscle groups as properties
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
}

struct WorkoutActivity: Decodable, Identifiable {
    let activityId: String
    let activityTime: String
    let workoutPreview: WorkoutPreview
    var id: String { activityId }
}

struct WorkoutPreview: Decodable {
    let workoutTitle: String
    let targetArea: String
    let totalDuration: Double  // seconds
    let totalVolume: Double    // lbs
    let totalAchievements: Double // PRs
    let programName: String?
    let coachName: String?
    let level: String?
}

struct TrainingFrequencyEntry: Decodable, Identifiable {
    let targetArea: String
    let count: Int
    let lastTrainedDate: String
    var id: String { targetArea }
}

struct ExternalActivity: Decodable, Identifiable {
    let id: String
    let workoutType: String
    let beginTime: String
    let activeDuration: Double
    let activeCalories: Double
    let averageHeartRate: Double
    let source: String
}

struct UserInfo: Decodable {
    let hasTonalProfile: Bool
    let tonalTokenExpired: Bool
    let tonalName: String?
    let email: String?
}
```

## Connection Error Handling

| Scenario                    | Message                                                |
| --------------------------- | ------------------------------------------------------ |
| Wrong Tonal credentials     | "Invalid email or password for your Tonal account"     |
| Network error               | "Connection error. Check your internet and try again." |
| Already connected           | Dismiss and refresh dashboard                          |
| Token expired (mid-session) | Show reconnect card on dashboard, "Session expired"    |

## Dashboard Error Handling

Each card handles errors independently via AsyncCard:

- Network failure: "Failed to load. Tap to retry." with retry button
- Individual card failure doesn't block other cards (parallel loading)
- Stale data: server-side cache returns last-known-good data

## Testing

- Connect Tonal with valid credentials -> dashboard shows real data
- Connect with wrong password -> error message
- Dashboard loads 5 cards in parallel -> all show data
- Kill app, relaunch -> dashboard still shows data (server cache)
- Token expires -> reconnect prompt appears
- Not connected -> shows connect card + HealthKit dashboard
- Profile shows "Connected" status with Tonal name
