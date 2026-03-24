# iOS App - Implementation Plan

## Overview

Native SwiftUI app for tonal.coach sharing the existing Convex backend. Lives in `ios/` directory of the monorepo. Connects to the same Convex deployment via `convex-swift`.

## Goals

- App Store presence for ASO (searches for "Tonal workout", "Tonal custom workout")
- Native Tonal deep links (more reliable than web)
- Push notifications (workout reminders, check-ins)
- Foundation for future authenticated features (favorites, direct push, AI coach chat)

## Architecture

```
tonal-coach/
  convex/              # Shared backend (unchanged)
  src/                 # Next.js web app (unchanged)
  ios/                 # NEW: SwiftUI app
    TonalCoach.xcodeproj
    TonalCoach/
      App/
        TonalCoachApp.swift          # Entry point, ConvexClient setup
        ContentView.swift            # Tab-based root navigation
      Auth/
        LoginView.swift              # Email + password login
        OnboardingView.swift         # Goal, split, training days
      Library/
        LibraryHomeView.swift        # Browse page (goal cards, chips, curated sections)
        WorkoutDetailView.swift      # Single workout detail
        WorkoutFiltersView.swift     # Filter sheet
        WorkoutCardView.swift        # Reusable card component
      Schedule/
        ScheduleView.swift           # Weekly calendar view
        DayDetailView.swift          # Single day with exercises
      Dashboard/
        DashboardView.swift          # Strength scores, readiness, recent workouts
        StatsView.swift              # Progress metrics
      Chat/
        ChatView.swift               # AI coach conversation
        MessageBubbleView.swift      # Single message
        ToolApprovalView.swift       # Approve/reject coach actions
      Profile/
        ProfileView.swift            # Settings, Tonal connection, preferences
        GoalsView.swift              # Active goals
        InjuriesView.swift           # Active injuries
      Shared/
        ConvexManager.swift          # ConvexClient singleton + auth state
        Models.swift                 # Swift types mirroring Convex schemas
        Theme.swift                  # Colors, fonts, spacing (dark theme)
        TonalDeepLink.swift          # Universal link handler
```

## Dependencies

| Package                             | Purpose                                           |
| ----------------------------------- | ------------------------------------------------- |
| `convex-swift`                      | Convex client (queries, mutations, subscriptions) |
| `clerk-convex-swift` or manual auth | Authentication                                    |

## Phased Implementation

### Phase 1: Project Setup + Workout Library (Week 1-2)

**Minimum viable app** - browse and view workouts, open in Tonal.

1. Create Xcode project in `ios/` directory
2. Add `convex-swift` package dependency
3. Configure `ConvexManager` with deployment URL (dev/prod build configs)
4. Build `LibraryHomeView` calling `libraryWorkouts.listFiltered`
5. Build `WorkoutDetailView` calling `libraryWorkouts.getBySlug`
6. Build `WorkoutCardView` matching web card design
7. Add universal link handler for `link.tonal.com` deep links
8. "Open in Tonal" button using native `UIApplication.open(url)`
9. Dark theme matching web design system

**Convex queries used:**

- `libraryWorkouts.listFiltered` (paginated browse)
- `libraryWorkouts.getBySlug` (detail view)
- `libraryWorkouts.getRelated` (related carousel)

**No auth required** - library is public.

### Phase 2: Auth + Dashboard (Week 3-4)

1. Implement email/password auth via Convex Auth
2. Build `LoginView` and `OnboardingView`
3. Tonal connection flow (`tonal/connectPublic.connectTonal`)
4. `DashboardView` with strength scores, muscle readiness, recent workouts
5. `ScheduleView` with weekly calendar
6. Tab navigation: Library | Schedule | Dashboard | Profile

**Convex queries used:**

- `users.getMe`
- `dashboard.getStrengthData`
- `dashboard.getMuscleReadiness`
- `dashboard.getWorkoutHistory`
- `schedule.getScheduleData`
- `weekPlans.getCurrentWeekPlan`

### Phase 3: AI Coach Chat (Week 5-6)

1. `ChatView` with real-time message streaming
2. Message bubbles for user and coach
3. Tool approval UI (approve/reject workout pushes)
4. Image upload for chat (progress photos)
5. Multimodal support (text + images)

**Convex queries/mutations used:**

- `threads.getCurrentThread`
- `chat.listMessages` (with streaming)
- `chat.createThread`
- `chat.sendMessageMutation`
- `chat.respondToToolApproval`
- `chat.generateImageUploadUrl`

### Phase 4: Full Feature Parity (Week 7-8)

1. Goals management (create, update, abandon)
2. Injury tracking (report, resolve, update severity)
3. Workout feedback (post-workout RPE + rating)
4. Progress photos (upload, view, compare)
5. Profile settings (accessories, preferences, password change)
6. Check-in preferences
7. Training preferences editor

### Phase 5: App Store + Push Notifications (Week 9-10)

1. App Store listing, screenshots, ASO keywords
2. Push notification setup (APNs + Convex webhook)
3. Notification types: workout reminders, check-ins, weekly recap
4. App Review submission
5. TestFlight beta

## Data Types (Swift)

Key structs needed, mirroring Convex schema:

```swift
struct WorkoutCard: Identifiable, Codable {
    let _id: String
    let slug: String
    let title: String
    let description: String
    let sessionType: String
    let goal: String
    let durationMinutes: Int
    let level: String
    let equipiseCount: Int
    let totalSets: Int
    let equipmentConfig: String?
    let equipmentNeeded: [String]
    var id: String { slug }
}

struct LibraryWorkout: Codable {
    let slug: String
    let title: String
    let description: String
    let sessionType: String
    let goal: String
    let durationMinutes: Int
    let level: String
    let equipmentConfig: String
    let blocks: [Block]
    let movementDetails: [MovementDetail]
    let targetMuscleGroups: [String]
    let exerciseCount: Int
    let totalSets: Int
    let equipmentNeeded: [String]
    let restGuidance: String?
    let workoutRationale: String?
    let whoIsThisFor: String?
    let faq: [FAQ]?
    let tonalDeepLinkUrl: String?
}

struct MovementDetail: Codable {
    let movementId: String
    let name: String
    let shortName: String
    let muscleGroups: [String]
    let sets: Int
    let reps: Int?
    let duration: Int?
    let phase: String
    let thumbnailMediaUrl: String?
    let accessory: String?
    let coachingCue: String?
}

struct Block: Codable {
    let exercises: [Exercise]
}

struct Exercise: Codable {
    let movementId: String
    let sets: Int
    let reps: Int?
    let duration: Int?
}

struct FAQ: Codable {
    let question: String
    let answer: String
}
```

## Design System

- **Dark theme** matching web (zinc backgrounds, one accent color)
- **Geist-inspired typography** (SF Pro as iOS equivalent)
- **Card-based UI** matching web workout cards
- **Tab bar navigation:** Library, Schedule, Dashboard, Chat, Profile
- **No bottom sheet overuse** - use full-screen push navigation

## App Store Optimization

- **Title:** "tonal.coach - AI Workouts for Tonal"
- **Subtitle:** "Custom workout library & AI coach"
- **Keywords:** tonal, workout, strength, custom workout, AI coach, push pull legs, home gym
- **Category:** Health & Fitness
- **Screenshots:** Library browse, workout detail with "Open in Tonal", AI coach chat, weekly schedule

## Risks

- **Apple review:** Must add enough native value beyond the website. Library browse + native deep links + push notifications should be sufficient.
- **Tonal trademark:** App name references Tonal. Position as a third-party companion app, not affiliated. Similar to how Strava companion apps exist.
- **Convex Swift maturity:** Production-ready per docs but less battle-tested than the JS client. May hit edge cases.
- **Auth flow:** Need to verify Convex Auth works with the Swift client. May need custom token exchange.

## Not In Scope (v1)

- Apple Watch app
- Widget extensions
- Siri shortcuts
- Offline mode
- iPad optimization (iPhone-only v1)
- Android (React Native considered separately)
