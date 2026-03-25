# iOS Premium Polish - Design Spec

**Date:** 2026-03-25
**Reference:** Oura Ring / Whoop - dark, data-forward, premium health tech
**Goal:** Transform TonalCoach iOS from polished MVP to world-class native app by adding intentional motion, haptics, data visualization animation, and loading choreography across all screens.

---

## Approach

**Foundation + Hero Screens:** Build reusable animation/interaction primitives first, then apply them to Dashboard (hero screen 1) and Chat (hero screen 2). Foundation primitives automatically elevate remaining screens (Schedule, Library, Onboarding, Profile) with minimal per-screen work.

**Web Parity Constraint:** All visual treatments must match the web app's existing design language - OKLch color tokens, card chrome, session type colors, ring color thresholds, readiness semantic colors, typography (DM Sans + Geist Mono with tabular-nums). This spec translates web CSS patterns to SwiftUI equivalents, not reinventing them.

**Minimum Deployment Target:** iOS 17.0 (already set in the project). All APIs used in this spec are available on iOS 17+ unless noted otherwise.

**Existing Component Policy:** This spec upgrades existing components rather than creating parallel duplicates. Specifically:

- The existing `CardModifier` / `.cardStyle()` in `Theme.swift` will be upgraded with shadow and refined chrome (not replaced by a new `PremiumCard`)
- The existing `CardShimmerModifier` / `.cardShimmer()` will be upgraded with new timing (1.2s sweep, 0.4s pause) and moved to a shared `ShimmerView.swift`
- The existing `CardButtonStyle` in `WorkoutCardView.swift` will be promoted to a shared `PressableCard.swift` and upgraded with the `snappy` spring

---

## 1. Motion & Animation System

### Spring Presets

Three named springs cover every animation in the app:

| Name     | Response | Damping | Use                                                    |
| -------- | -------- | ------- | ------------------------------------------------------ |
| `snappy` | 0.3      | 0.7     | Button presses, toggles, small state changes           |
| `smooth` | 0.5      | 0.8     | Card expansions, sheet presentations, view transitions |
| `gentle` | 0.8      | 0.85    | Ring fills, bar growth, number count-ups               |

These live in `AnimationConstants.swift` as static `Animation` properties.

### Staggered Reveals

A `StaggeredAppear` view modifier. Each item receives an index; the modifier computes delay as `index * staggerInterval` (default 60ms). Items start at opacity 0 + 12pt vertical offset, then animate to final position with the `smooth` spring.

Usage: Apply to each card in a `VStack`/`LazyVStack` with its position index. The modifier tracks whether it has already animated via an internal `@State` flag, so it does not replay when views are recycled inside `Lazy*` containers.

Respects `UIAccessibility.isReduceMotionEnabled` - delays become 0, animations become instant.

### Counting Text

A `CountingText` view. Takes a target `Double`, optional format string, and duration (default 0.8s). Uses `TimelineView(.animation)` to interpolate from 0 to target with ease-out curve. Renders with Geist Mono and `monospacedDigit()` modifier for stable column alignment.

Respects reduce motion - shows final value immediately.

### Navigation Transitions

Standard `NavigationStack` push transitions are used for all drill-in navigation (schedule day -> detail, library card -> detail, etc.). SwiftUI's `matchedGeometryEffect` across `NavigationStack` destinations is unreliable in practice due to namespace sharing constraints.

Instead, the premium feel comes from:

- Card press states (scale 0.97 on touch) providing tactile feedback before navigation
- Content animations firing on the destination view's `onAppear` (staggered reveals, ring fills)
- Standard iOS push animation, which users expect and is already polished

**iOS 18+ optional enhancement:** If the deployment target is raised to iOS 18 in the future, `NavigationTransition.zoom(sourceID:in:)` can be adopted for card-to-detail hero transitions. This is deferred, not blocked on.

**Image fullscreen (Chat):** For image thumbnail -> fullscreen expansion, use `.fullScreenCover` with `matchedGeometryEffect`. This works reliably because both source and destination are in the same view hierarchy (no NavigationStack boundary). Define `@Namespace` in `MessageBubble` and share with the fullscreen overlay.

---

## 2. Haptic & Feedback System

### Haptic Vocabulary

A `HapticEngine` helper with static methods:

| Method       | UIKit Equivalent                            | Trigger                                   |
| ------------ | ------------------------------------------- | ----------------------------------------- |
| `.tap()`     | `UIImpactFeedbackGenerator(.light)`         | Card tap, navigation                      |
| `.select()`  | `UISelectionFeedbackGenerator`              | Toggle, chip selection, picker change     |
| `.success()` | `UINotificationFeedbackGenerator(.success)` | Ring animation complete, action confirmed |
| `.refresh()` | `UIImpactFeedbackGenerator(.medium)`        | Pull-to-refresh threshold reached         |

Generators are pre-initialized and `prepare()`d to eliminate latency on first fire.

### Press State

A `PressableCard` view modifier (or `ButtonStyle`):

- Touch down: scale to 0.97, `snappy` spring
- Touch up: scale to 1.0, `snappy` spring
- Fires `HapticEngine.tap()` on release
- Applied via `.pressableCard()` modifier on any tappable card

### Visual Feedback

- Success: brief border tint flash to `primary/30` (200ms fade out)
- Error: 3-oscillation horizontal shake (total 300ms) + `UINotificationFeedbackGenerator(.error)`
- Refresh complete: cards pulse opacity 1.0 -> 0.95 -> 1.0 (250ms)

---

## 3. Card & Data Visualization System

### Card Chrome (matching web)

Upgrade the existing `CardModifier` / `.cardStyle()` in `Theme.swift` to include shadow:

```
Background: Theme.Colors.card (oklch 0.155 0.012 265)
Border: RoundedRectangle overlay, Color.white.opacity(0.08), 1pt stroke
Shadow: .shadow(color: .black.opacity(0.1), radius: 8, y: 4)  // NEW
Corner radius: Theme.CornerRadius.lg (12pt)
```

Verify the iOS `Theme` color values match the web's dark mode OKLch tokens exactly:

- `background`: oklch(0.115 0.012 265)
- `card`: oklch(0.155 0.012 265)
- `muted`: oklch(0.195 0.012 265)
- `primary`: oklch(0.78 0.154 195)
- `border`: white at 8% opacity

### "Today" Glow Effect

For the current day's schedule card:

- Border ring: `primary` at 30% opacity
- Outer glow: `primary` blurred shadow (`radius: 10, y: 0`) - `shadow-[0_0_20px_-4px_var(--primary)]` equivalent
- Scale: 1.01 (subtle, just enough to lift it above siblings)

### Progress Rings

Translating web's `ProgressRing.tsx` to SwiftUI:

```
Circle()
    .trim(from: 0, to: animatedProgress)
    .stroke(style: StrokeStyle(lineWidth: 8, lineCap: .round))
    .foregroundColor(ringColor)
    .rotationEffect(.degrees(-90))
    .animation(.gentle, value: animatedProgress)
```

- Background track: `Color.white.opacity(0.08)`
- Active arc colors (matching web's `scoreColor()` thresholds):
  - Score >= 70%: `Theme.Colors.primary` (cyan)
  - Score 40-70%: `Theme.Colors.chart5` (amber)
  - Score < 40%: `Theme.Colors.chart4` (rose)
- Existing `ScoreRing` must be modified to add a `ringColor` computed property based on these thresholds (currently always uses `Theme.Colors.primary`)
- Sizes: 96pt (overall), 64pt (region rings)
- Inner glow: overlay shadow `Theme.Colors.primary.opacity(0.3)` with blur radius 10
- Center score: `CountingText` in Geist Mono, bold

### Training Frequency Bars

Matching web's `TrainingFrequencyChart.tsx`:

- Container: `Capsule().fill(Theme.Colors.muted.opacity(0.5))`, height 8pt, full width
- Bar fill: `Capsule().fill(chartColor)`, animated width from 0 to target
- Animation: `gentle` spring, staggered 80ms per bar
- 5-color rotation: chart1 (cyan), chart2 (blue), chart3 (purple), chart4 (rose), chart5 (amber)
- Labels: body part name left, volume right in Geist Mono `tabular-nums`

### Muscle Readiness Map

Matching web's `MuscleReadinessMap.tsx`:

- 2-column `LazyVGrid`
- Each cell: rounded rectangle with semantic background tint
  - Ready (>60): emerald at 10% opacity, emerald-400 text
  - Recovering (31-60): amber at 10% opacity, amber-400 text
  - Fatigued (<=30): rose at 10% opacity, rose-400 text
- These thresholds match the web's `MuscleReadinessMap.tsx` exactly. The existing iOS `MuscleCell` uses different thresholds (>80/60-80/<60) and must be updated to match.
- Cell content: muscle name (semibold, xs), readiness score right-aligned
- Staggered appear: 40ms per cell

### Session Type Colors

Verify iOS `SessionType` enum colors match web exactly:

| Type      | Web Color   | iOS Must Match          |
| --------- | ----------- | ----------------------- |
| Push      | blue-500    | `Color(hex: "#3b82f6")` |
| Pull      | purple-500  | `Color(hex: "#a855f7")` |
| Legs      | emerald-500 | `Color(hex: "#10b981")` |
| Upper     | orange-400  | `Color(hex: "#fb923c")` |
| Lower     | teal-400    | `Color(hex: "#2dd4bf")` |
| Full Body | pink-500    | `Color(hex: "#ec4899")` |

Applied as 3pt leading edge accent on schedule and detail cards.

---

## 4. Loading Choreography & Screen Transitions

### Skeleton Shimmer

A `ShimmerView` component:

- Base: `RoundedRectangle` filled with `Theme.muted.opacity(0.8)`
- Gradient overlay sweeps left-to-right: clear -> white at 15% -> clear
- Sweep duration: 1.2s with 0.4s pause between sweeps
- Takes `height` and optional `width` parameters for different placeholder shapes

Each dashboard card has a skeleton variant matching its final layout:

- Strength: circular placeholder + 3 smaller circles
- Readiness: 2-column grid of rounded rects
- Workouts: 3 horizontal bar placeholders
- Frequency: 5 horizontal bar placeholders of varying width

### Content Reveal Sequence

When data replaces a skeleton (3 phases):

1. Skeleton cross-fades out (200ms, `easeOut`)
2. Content fades in + slides up 8pt (300ms, `smooth` spring)
3. Data animations fire: rings fill, bars grow, numbers count (700ms, `gentle` spring)

Implemented as an `AsyncDataCard` wrapper that manages the loading -> loaded state transition with these phases.

### Dashboard Load Sequence

- Greeting header + coach CTA appear immediately (local data, no loading)
- All cards show skeletons simultaneously
- As each card's data arrives independently, it reveals with the 3-phase sequence
- Natural stagger emerges from varying backend response times
- No artificial delay - faster data appears faster
- **Performance note:** If profiling reveals frame drops when multiple cards animate simultaneously, add a 100ms artificial stagger between card content-reveal phases to spread animation load across frames

### Tab Transitions

- Tab content cross-fades with 150ms `easeInOut` on tab switch
- Applied via `.transition(.opacity)` on the tab content container
- Active tab icon briefly scales to 1.15 then settles to 1.0 (`snappy` spring)
- `.light` haptic on tab selection

### Drill-In Transitions

- All drill-in navigation (schedule -> detail, library -> detail, etc.) uses standard iOS push transition
- Premium feel comes from: press state on the source card + content animations on the destination view
- See Section 1 (Navigation Transitions) for rationale on deferring matched geometry across NavigationStack

### Pull-to-Refresh

Keep the standard `.refreshable` modifier and system refresh indicator. A custom pull-to-refresh (ring that fills as you pull) would require dropping `.refreshable` and implementing custom scroll offset tracking via `GeometryReader` or `UIScrollView` bridging - significant scope increase for marginal UX gain.

Enhancement: add `.medium` haptic when refresh triggers (via `.sensoryFeedback(.impact(flexibility: .solid, intensity: 0.6), trigger: isRefreshing)` on iOS 17+).

---

## 5. Dashboard Transformation

### Layout

```
ScrollView {
    VStack(spacing: 16) {          // matches web gap-4
        GreetingHeader             // "Good morning, Jeff" + date
        CoachCTABanner             // "Ask your coach about today's plan"
        StrengthScoreCard          // hero ring + 3 region rings
        MuscleReadinessCard        // 2-col semantic grid
        RecentWorkoutsCard         // compact list with session dots
        TrainingFrequencyCard      // horizontal animated bars
        ExternalActivitiesCard     // simple list
    }
    .padding(.horizontal, 16)
}
.refreshable { ... }               // custom ring refresh
```

Each card wrapped in `AsyncDataCard` for skeleton -> reveal -> animate sequence.
Each card applies `StaggeredAppear` with its position index (60ms stagger).

### Greeting Header

- "Good morning/afternoon/evening, [First Name]"
- Style: `.title` weight bold, `kerning(-0.5)` for tight tracking (matches web's `tracking-tight`)
- Date subtitle: `.subheadline` in `muted-foreground`
- Appears instantly, no loading state

### Coach CTA Banner

- Rounded-xl card with `primary.opacity(0.1)` background
- Text: "Ask your coach about today's plan" in `primary.opacity(0.8)`
- Leading coach icon (sparkle or message bubble)
- `PressableCard` modifier - taps navigate to Chat tab
- Appears with the first stagger slot

### Strength Score Card

- Title: "STRENGTH SCORES" in `text-xs font-semibold uppercase tracking-wider text-muted-foreground` (matching web)
- Overall ring: 96pt, 10pt stroke, animated fill + inner glow + `CountingText` center
- 3 region rings: 64pt each in horizontal `HStack(spacing: 24)`, each with label below
- Percentile badge: pill with `primary.opacity(0.15)` background
- Ring colors follow score thresholds from Section 3

### Muscle Readiness Card

- Title matches web pattern
- 2-column grid from Section 3
- Cells stagger-appear 40ms
- Semantic colors from web

### Recent Workouts Card

- Compact rows: session type color dot (8pt circle), workout name, duration pill, volume
- Duration pill: `muted.opacity(0.6)` background, 10pt text, matching web's `bg-muted/60 px-1.5 py-0.5 text-[10px]`
- Rows slide in from right with 50ms stagger
- Max 5 recent, with "View all" link at bottom

### Training Frequency Card

- Animated horizontal bars from Section 3
- 80ms cascade stagger
- Labels + values in standard layout

### External Activities Card

- Standard card reveal, no special per-item animation
- Simple list with activity type icon, name, duration

---

## 6. Chat Transformation

### Message Bubbles (matching web's ChatMessage.tsx)

**User messages:**

- Right-aligned, `primary` background, white text
- Corner radius: 24pt on all corners except 6pt top-right (matches web's `rounded-2xl rounded-tr-sm`)
- Appear animation: slide in from right 12pt + fade (200ms, `snappy` spring)

**Coach messages:**

- Left-aligned, `card` background with `white.opacity(0.08)` border
- Corner radius: 24pt all except 6pt top-left
- Avatar: 28pt circle with `primary` to purple gradient (matches web)
- Appear animation: fade in + slide up 6pt (250ms, `smooth` spring)

**Grouping:**

- Same sender within 2 minutes: 4pt gap (instead of 12pt), avatar hidden, timestamp hidden
- Timestamp shown on tap for grouped messages
- Ungrouped messages: 12pt gap, avatar visible, timestamp visible
- This sender-proximity grouping is a new layer that operates within the existing date-based `MessageGroup` in `ChatView.swift`. Date dividers stay; sender grouping controls visual spacing/avatar visibility within each date group. Add an `isGroupedWithPrevious` computed property per message.

### Streaming Text

- New characters fade from 0.6 to 1.0 opacity over 100ms
- Soft cursor pulse at streaming end (opacity 1.0 -> 0.4 -> 1.0, 1s cycle)
- Streaming complete: cursor pulse stops, no visual jump

### Thinking Indicator (matching web)

- 3 dots, each 6pt circle in `muted-foreground`
- Animation per dot: opacity 0.3 / scale 0.85 -> opacity 1.0 / scale 1.0 -> opacity 0.3 / scale 0.85
- 200ms stagger between dots (dot 1 at 0ms, dot 2 at 200ms, dot 3 at 400ms)
- Total cycle: 1.4s
- Sits inside a coach-styled bubble with avatar

### Tool Approval Cards

- Slide in with `smooth` spring (not instant appear)
- Approve button: keep existing `Theme.Colors.success` (green) background, add `shadow-md shadow-success/20` equivalent, white text
- Deny button: ghost style (transparent background, `muted-foreground` text)
- After resolution: card compresses vertically (200ms) to a single-line summary
  - Approved: checkmark icon + "Approved: [action name]" in muted text
  - Denied: x-mark icon + "Declined" in muted text
- This collapse prevents resolved approvals from dominating scroll history

### Image Messages

- Thumbnails: rounded-lg, `white.opacity(0.08)` border, max 200pt wide
- Multiple images: horizontal scroll with 8pt gap
- Tap to expand: matched geometry from thumbnail to fullscreen overlay
- Fullscreen: blurred background, pinch-to-zoom, swipe-down to dismiss
- Dismiss has velocity threshold - fast swipe dismisses, slow drag shows spring resistance

### Suggestion Chips

- Staggered fade-in: 40ms per chip when empty state appears
- Press state: chip scales to 0.95 (`snappy`), `.selection` haptic
- On selection: selected chip populates input, all chips fade out (200ms)

### Input Bar

- Send button: scale 0.9 -> 1.0 with `snappy` spring when text becomes non-empty
- Image attachment count: small pill badge, animates in with `snappy` spring
- Input field border: transitions from `border.opacity(0.5)` to `primary.opacity(0.3)` on focus (200ms)
- Message list scroll-to-bottom on keyboard appear: `smooth` spring

---

## 7. Remaining Screens

### Schedule

- All day cards: upgraded `.cardStyle()` chrome + `PressableCard` modifier (automatic from foundation)
- Today card: glow effect from Section 3
- Past/missed days: 60% opacity
- Day cards stagger-appear 60ms left-to-right
- Day card -> Day detail: standard push transition (press state on card provides tactile feedback)
- Day detail exercise rows: stagger-appear 40ms
- Session type 3pt leading accent

### Library

- Horizontal scroll sections: subtle parallax (1-2pt card shift on scroll, decorative)
- Workout cards: `PressableCard` modifier
- Workout detail hero image: fade in + scale 1.02 -> 1.0 (500ms, `gentle`)
- Filter sheet: `smooth` spring presentation
- Search results: cross-fade on filter change (200ms)

### Onboarding

- Step transitions: upgrade to `smooth` spring
- Goal cards: `PressableCard` + `.selection` haptic
- Step indicator: active dot scales 1.0 -> 1.2 (`snappy`)
- Ready screen (step 3): coach avatar gentle scale 0.9 -> 1.0, benefit list stagger 60ms

### Profile

- Section cards: upgraded `.cardStyle()` chrome
- Toggles: `.selection` haptic
- Sign out: `.warning` haptic + destructive confirmation dialog

### Tab Bar

- Active icon: scale 1.0 -> 1.15 -> 1.0 on selection (`snappy` spring)
- `.light` haptic on tab switch
- Active: `primary` tint, Inactive: `muted-foreground.opacity(0.6)`
- Content cross-fade: 150ms `easeInOut`

### App Launch

- Splash: centered logo/icon, fades into loaded state
- Session restore: skeleton dashboard appears immediately
- Login needed: login view fades in from splash

---

## 8. Accessibility

All motion respects `UIAccessibility.isReduceMotionEnabled`:

- Stagger delays become 0
- Springs become `.default` (instant)
- `CountingText` shows final value immediately
- Skeleton shimmer becomes static fill
- Matched geometry transitions become standard push

Press states (scale) and haptics still fire - they provide feedback independent of motion preference.

All existing accessibility labels and traits remain. New interactive elements (coach CTA banner, suggestion chips) receive appropriate labels.

---

## 9. Implementation Scope

### Session 1: Foundation (~5-6 new files)

| File                       | Purpose                                                        |
| -------------------------- | -------------------------------------------------------------- |
| `AnimationConstants.swift` | Spring presets, duration constants, stagger intervals          |
| `HapticEngine.swift`       | Haptic vocabulary with pre-initialized generators              |
| `PressableCard.swift`      | Promoted from `CardButtonStyle`, upgraded with `snappy` spring |
| `StaggeredAppear.swift`    | View modifier for cascading reveal animations                  |
| `CountingText.swift`       | Animated number display with TimelineView                      |
| `ShimmerView.swift`        | Upgraded from `CardShimmerModifier`, new timing                |

Also:

- Audit `Theme.swift` to verify all color tokens match web OKLch values exactly
- Upgrade `CardModifier` / `.cardStyle()` in `Theme.swift` with shadow
- Remove old `CardButtonStyle` and `CardShimmerModifier` from `WorkoutCardView.swift` after promoting to shared files

### Session 2: Dashboard Transformation

Modify existing files:

- `TonalDashboardView.swift` - Add staggered reveals, coach CTA banner, pull-to-refresh
- `StrengthScoreCard.swift` - Animated rings, counting text, inner glow
- `MuscleReadinessCard.swift` - Semantic colors, staggered cells
- `RecentWorkoutsCard.swift` - Staggered rows, session color dots
- `TrainingFrequencyCard.swift` - Animated bars, cascade stagger
- `AsyncCard.swift` - Upgrade to 3-phase skeleton -> reveal -> animate sequence

### Session 3: Chat Transformation

Modify existing files:

- `MessageBubble.swift` - Asymmetric appear animations, grouped spacing, corner radius
- `ChatView.swift` - Message list scroll behavior, overall choreography
- `ChatInputBar.swift` - Send button animation, focus border, attachment badge
- `ThinkingIndicator.swift` - 3-dot staggered animation matching web
- `ToolApprovalCard.swift` - Slide-in + collapse after resolution
- `ChatModels.swift` - Add grouping logic (same sender within 2min)

### Session 4: Remaining Screens

Modify existing files:

- `ScheduleView.swift` - Today glow, stagger, press states
- `DayDetailView.swift` - Exercise row stagger
- `LibraryHomeView.swift` - Parallax, press states
- `WorkoutDetailView.swift` - Hero image settle
- `TrainingOnboardingFlow.swift` - Spring transitions
- `OnboardingReadyView.swift` - Avatar + list stagger
- `ContentView.swift` - Tab bar haptics, icon scale, content cross-fade
- `TonalCoachApp.swift` - Launch sequence

---

## 10. Design Principles

1. **Match web, extend for native.** Colors, thresholds, card chrome, and session type colors are identical. Haptics and gesture physics are iOS-only extensions.
2. **Nothing pops.** Every element animates into position. Rings fill, bars grow, numbers count, cards arrive.
3. **Asymmetry is intentional.** Sending a message feels different from receiving. Today feels different from other days. Data-heavy cards animate differently from simple lists.
4. **Respect the platform.** Reduce motion, standard navigation where appropriate, native scroll physics. Premium doesn't mean custom for custom's sake.
5. **Foundation compounds.** Every new screen or feature built after this work inherits the polish through the shared primitives.
