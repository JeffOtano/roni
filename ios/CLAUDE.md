# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with the iOS app.

## Build & Run

The project uses XcodeGen. Generate the Xcode project from `project.yml`:

    cd ios && xcodegen generate

Then open `TonalCoach.xcodeproj` in Xcode 15+ and run on a simulator or device (iOS 17+).

## Dependencies

- **ConvexMobile** (SPM, main branch) -- Convex Swift SDK for real-time subscriptions, mutations, actions
- **HealthKit.framework** -- Apple Health data (read-only)
- No other third-party dependencies. All UI is native SwiftUI.

## Architecture

### State Management

Uses `@Observable` (iOS 17+), not Combine ObservableObject. Key singletons:

- **ConvexManager** (`Shared/ConvexManager.swift`) -- wraps `ConvexClientWithAuth`. Provides `subscribe()`, `query()`, `mutation()`, `action()`. Injected as environment value.
- **AuthManager** (`Auth/AuthManager.swift`) -- `AuthManager.shared` singleton. Handles sign in/up/out, password reset, session restore from Keychain. Beta cap pre-check before signup.
- **HealthKitManager** (`Health/HealthKitManager.swift`) -- reads 20+ HealthKit data types. Observer queries auto-refresh on data changes.
- **NotificationManager** (`Notifications/NotificationManager.swift`) -- APNs registration and device token management.

All managers are injected via SwiftUI `.environment()` in `TonalCoachApp.swift`.

### Convex Integration

- Dev URL: `https://quaint-bulldog-653.convex.cloud`
- Prod URL: `https://chatty-hawk-29.convex.cloud`
- Auth tokens stored in Keychain via `KeychainHelper`
- `PasswordAuthProvider` reads cached tokens for Convex auth
- Subscriptions use `ConvexManager.subscribe(to:with:)` returning Combine publishers
- One-shot queries use `ConvexManager.query(_:args:)` with 15s timeout

### Module Layout

- `App/` -- Entry point, root navigation (auth -> onboarding -> main), deep link handling
- `Auth/` -- Login, signup, password reset, welcome carousel, Keychain storage
- `Chat/` -- Real-time AI coach chat. `ChatViewModel` manages threads, messages, image uploads, tool approvals
- `Health/` -- HealthKit permission flow, daily sync via `health.syncSnapshot` mutation
- `Library/` -- Browse workout plans with filtering
- `Notifications/` -- APNs setup, permission view, settings
- `Onboarding/` -- Training preferences questionnaire (split, days, duration)
- `Profile/` -- User profile and sign out
- `Schedule/` -- Weekly plan display with day detail drill-down
- `Tonal/` -- Dashboard cards: strength scores, training load, muscle readiness, sleep, recent workouts, coach insights
- `Shared/` -- Design system and utilities (see below)

### Design System

- **Theme.swift** -- OKLCH-based color tokens (matches web app), typography scale (DM Sans + Geist Mono), spacing scale, corner radii, view modifiers (CardModifier, PrimaryButtonModifier, etc.)
- **AnimationConstants.swift** -- Spring presets (snappy/smooth/gentle), duration constants, stagger intervals. Respects `UIAccessibility.isReduceMotionEnabled`.
- **HapticEngine.swift** -- Centralized haptic feedback (light, medium, selection, success, error)
- **Custom components:** PressableCard, ShimmerView, SparklineView, StaggeredAppear, CountingText

### Conventions

- One view per file, named export matching filename
- Use `Theme.Colors.*`, `Theme.Fonts.*`, `Theme.Spacing.*` instead of raw values
- Use `Animate.snappy` / `Animate.smooth` instead of inline animation values
- Use `foregroundStyle()` not deprecated `foregroundColor()`
- Static DateFormatters (avoid allocating in body computations)
