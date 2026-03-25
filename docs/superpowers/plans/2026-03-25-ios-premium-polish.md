# iOS Premium Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform TonalCoach iOS from polished MVP to Oura/Whoop-level premium by adding intentional motion, haptics, data visualization animation, and loading choreography.

**Architecture:** Foundation-first approach. Build 6 reusable animation/interaction primitives (springs, haptics, press states, stagger reveals, counting text, shimmer), then apply to Dashboard (hero 1) and Chat (hero 2), then remaining screens. Upgrades existing components rather than creating duplicates.

**Tech Stack:** SwiftUI (iOS 17+), ConvexMobile, UIKit haptic generators

**Spec:** `docs/superpowers/specs/2026-03-25-ios-premium-polish-design.md`

---

## File Map

### New Files (Session 1 Foundation)

| File                                             | Responsibility                                                                 |
| ------------------------------------------------ | ------------------------------------------------------------------------------ |
| `ios/TonalCoach/Shared/AnimationConstants.swift` | Spring presets (snappy/smooth/gentle), duration constants, stagger intervals   |
| `ios/TonalCoach/Shared/HapticEngine.swift`       | Haptic vocabulary (tap/select/success/refresh) with pre-initialized generators |
| `ios/TonalCoach/Shared/PressableCard.swift`      | ButtonStyle with scale-0.97 press + haptic, promoted from CardButtonStyle      |
| `ios/TonalCoach/Shared/StaggeredAppear.swift`    | View modifier for cascading reveal animations with replay guard                |
| `ios/TonalCoach/Shared/CountingText.swift`       | Animated number display using TimelineView                                     |
| `ios/TonalCoach/Shared/ShimmerView.swift`        | Skeleton shimmer with 1.2s sweep, promoted from CardShimmerModifier            |

### Modified Files (Sessions 1-4)

| File                                                     | Changes                                                                             |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `ios/TonalCoach/Shared/Theme.swift`                      | Add shadow to CardModifier, add chart color tokens, verify OKLch parity             |
| `ios/TonalCoach/Library/WorkoutCardView.swift`           | Remove CardButtonStyle and CardShimmerModifier (promoted to shared)                 |
| `ios/TonalCoach/Tonal/AsyncCard.swift`                   | 3-phase skeleton -> reveal -> animate transition                                    |
| `ios/TonalCoach/Tonal/StrengthScoreCard.swift`           | Animated rings, score-based colors, CountingText, inner glow                        |
| `ios/TonalCoach/Tonal/MuscleReadinessCard.swift`         | Fix thresholds (>60/31-60/<=30), semantic colors, stagger                           |
| `ios/TonalCoach/Tonal/TrainingFrequencyCard.swift`       | Animated bars with cascade stagger                                                  |
| `ios/TonalCoach/Tonal/RecentWorkoutsCard.swift`          | Staggered rows, session color dots                                                  |
| `ios/TonalCoach/Tonal/TonalDashboardView.swift`          | Greeting header, coach CTA, staggered cards, refresh haptic                         |
| `ios/TonalCoach/Chat/MessageBubble.swift`                | Corner radii (24/6pt), appear animations, sender grouping spacing, image fullscreen |
| `ios/TonalCoach/Chat/ChatView.swift`                     | Sender-proximity grouping, scroll choreography, chip stagger                        |
| `ios/TonalCoach/Chat/ChatInputBar.swift`                 | Send button animation, focus border, attachment badge                               |
| `ios/TonalCoach/Chat/ThinkingIndicator.swift`            | Match web timing (0.3/0.85 scale, 200ms stagger, 1.4s cycle)                        |
| `ios/TonalCoach/Chat/ToolApprovalCard.swift`             | Slide-in animation, collapse after resolution                                       |
| `ios/TonalCoach/Schedule/ScheduleView.swift`             | Today glow, stagger, press states                                                   |
| `ios/TonalCoach/Schedule/DayDetailView.swift`            | Exercise row stagger                                                                |
| `ios/TonalCoach/Library/LibraryHomeView.swift`           | Press states on cards                                                               |
| `ios/TonalCoach/Library/WorkoutDetailView.swift`         | Hero image settle animation                                                         |
| `ios/TonalCoach/App/ContentView.swift`                   | Tab icon scale animation, content cross-fade                                        |
| `ios/TonalCoach/Onboarding/TrainingOnboardingFlow.swift` | Smooth spring step transitions                                                      |
| `ios/TonalCoach/Onboarding/OnboardingReadyView.swift`    | Avatar scale, benefit list stagger                                                  |
| `ios/TonalCoach/Profile/ProfileView.swift`               | Toggle haptics, sign-out confirmation                                               |
| `ios/TonalCoach/App/TonalCoachApp.swift`                 | Launch sequence, haptic warmup                                                      |

---

## Session 1: Foundation

### Task 1: AnimationConstants

**Files:**

- Create: `ios/TonalCoach/Shared/AnimationConstants.swift`

- [ ] **Step 1: Create AnimationConstants.swift**

```swift
import SwiftUI

enum Animate {
    // MARK: - Spring Presets
    static let snappy: Animation = .spring(response: 0.3, dampingFraction: 0.7)
    static let smooth: Animation = .spring(response: 0.5, dampingFraction: 0.8)
    static let gentle: Animation = .spring(response: 0.8, dampingFraction: 0.85)

    // MARK: - Durations
    static let quickFeedback: Double = 0.15
    static let standard: Double = 0.2
    static let contentReveal: Double = 0.3
    static let dataViz: Double = 0.7

    // MARK: - Stagger Intervals
    static let cardStagger: Double = 0.06    // 60ms between cards
    static let cellStagger: Double = 0.04    // 40ms between grid cells
    static let rowStagger: Double = 0.05     // 50ms between list rows
    static let barStagger: Double = 0.08     // 80ms between chart bars
    static let chipStagger: Double = 0.04    // 40ms between chips

    // MARK: - Reduce Motion Helper
    static var prefersReducedMotion: Bool {
        UIAccessibility.isReduceMotionEnabled
    }

    static func staggerDelay(index: Int, interval: Double) -> Double {
        prefersReducedMotion ? 0 : Double(index) * interval
    }
}
```

- [ ] **Step 2: Add file to Xcode project**

Open `ios/TonalCoach.xcodeproj/project.pbxproj` and add the new file reference to the TonalCoach target, or use Xcode's "Add Files" flow. Verify the file compiles.

Run: `cd ios && xcodebuild -scheme TonalCoach -destination 'platform=iOS Simulator,name=iPhone 16 Pro' build 2>&1 | tail -5`
Expected: BUILD SUCCEEDED

- [ ] **Step 3: Commit**

```bash
git add ios/TonalCoach/Shared/AnimationConstants.swift ios/TonalCoach.xcodeproj/
git commit -m "feat(ios): add animation constants - spring presets, durations, stagger intervals"
```

---

### Task 2: HapticEngine

**Files:**

- Create: `ios/TonalCoach/Shared/HapticEngine.swift`
- Modify: `ios/TonalCoach/Shared/Theme.swift` (remove old Haptics enum)

- [ ] **Step 1: Create HapticEngine.swift**

```swift
import UIKit

enum HapticEngine {
    private static let lightImpact = UIImpactFeedbackGenerator(style: .light)
    private static let mediumImpact = UIImpactFeedbackGenerator(style: .medium)
    private static let selection = UISelectionFeedbackGenerator()
    private static let notification = UINotificationFeedbackGenerator()

    /// Prepare all generators to eliminate first-fire latency
    static func warmUp() {
        lightImpact.prepare()
        mediumImpact.prepare()
        selection.prepare()
        notification.prepare()
    }

    /// Light tap - card press, navigation
    static func tap() {
        lightImpact.impactOccurred()
        lightImpact.prepare()
    }

    /// Selection change - toggles, chips, pickers
    static func select() {
        selection.selectionChanged()
        selection.prepare()
    }

    /// Success - ring animation complete, action confirmed
    static func success() {
        notification.notificationOccurred(.success)
        notification.prepare()
    }

    /// Refresh threshold reached
    static func refresh() {
        mediumImpact.impactOccurred()
        mediumImpact.prepare()
    }

    /// Error - shake, failed action
    static func error() {
        notification.notificationOccurred(.error)
        notification.prepare()
    }
}
```

- [ ] **Step 2: Update Theme.swift Haptics to delegate to HapticEngine**

In `Theme.swift`, the existing `Haptics` enum (lines 446-453) calls `UIImpactFeedbackGenerator` directly each time. Update it to delegate to `HapticEngine` so existing call sites keep working but use the pre-initialized generators:

```swift
// Replace the Haptics enum body (Theme.swift lines 447-452)
enum Haptics {
    static func light() { HapticEngine.tap() }
    static func medium() { HapticEngine.refresh() }
    static func selection() { HapticEngine.select() }
    static func success() { HapticEngine.success() }
    static func error() { HapticEngine.error() }
}
```

- [ ] **Step 3: Add warmUp call to app launch**

In `TonalCoachApp.swift`, add `HapticEngine.warmUp()` in the app's `init()` or `.onAppear` of the root view.

- [ ] **Step 4: Add file to Xcode project and verify build**

Run: `cd ios && xcodebuild -scheme TonalCoach -destination 'platform=iOS Simulator,name=iPhone 16 Pro' build 2>&1 | tail -5`
Expected: BUILD SUCCEEDED

- [ ] **Step 5: Commit**

```bash
git add ios/TonalCoach/Shared/HapticEngine.swift ios/TonalCoach/Shared/Theme.swift ios/TonalCoach/App/TonalCoachApp.swift ios/TonalCoach.xcodeproj/
git commit -m "feat(ios): add HapticEngine with pre-initialized generators"
```

---

### Task 3: PressableCard

**Files:**

- Create: `ios/TonalCoach/Shared/PressableCard.swift`
- Modify: `ios/TonalCoach/Library/WorkoutCardView.swift` (remove old CardButtonStyle)

- [ ] **Step 1: Create PressableCard.swift**

Promoted from the existing `CardButtonStyle` in WorkoutCardView.swift (lines 159-169), upgraded with `snappy` spring:

```swift
import SwiftUI

/// ButtonStyle that gives cards a tactile press-down effect with haptic feedback.
/// Replaces the previous CardButtonStyle from WorkoutCardView.
struct PressableCardStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1.0)
            .animation(Animate.snappy, value: configuration.isPressed)
            .onChange(of: configuration.isPressed) { _, isPressed in
                if !isPressed {
                    HapticEngine.tap()
                }
            }
    }
}

extension View {
    /// Apply pressable card interaction to any tappable card.
    func pressableCard() -> some View {
        self.buttonStyle(PressableCardStyle())
    }
}
```

- [ ] **Step 2: Remove CardButtonStyle from WorkoutCardView.swift**

Delete lines 159-169 (the `CardButtonStyle` struct) from `WorkoutCardView.swift`.

- [ ] **Step 3: Update all call sites using CardButtonStyle to use PressableCardStyle**

Search the codebase for `CardButtonStyle` references. Known usages:

- `ScheduleView.swift` line ~72: `.buttonStyle(CardButtonStyle())` on NavigationLink
- `LibraryHomeView.swift` lines ~212, ~318, ~495: `.buttonStyle(CardButtonStyle())` on workout cards
- `WorkoutDetailView.swift` line ~638: `.buttonStyle(CardButtonStyle())` on related workout cards

Replace all with `.pressableCard()`.

- [ ] **Step 4: Add file to Xcode project and verify build**

Run: `cd ios && xcodebuild -scheme TonalCoach -destination 'platform=iOS Simulator,name=iPhone 16 Pro' build 2>&1 | tail -5`
Expected: BUILD SUCCEEDED

- [ ] **Step 5: Commit**

```bash
git add ios/TonalCoach/Shared/PressableCard.swift ios/TonalCoach/Library/WorkoutCardView.swift ios/TonalCoach/Schedule/ScheduleView.swift ios/TonalCoach/Library/LibraryHomeView.swift ios/TonalCoach/Library/WorkoutDetailView.swift ios/TonalCoach.xcodeproj/
git commit -m "feat(ios): add PressableCardStyle, promote from CardButtonStyle"
```

---

### Task 4: StaggeredAppear

**Files:**

- Create: `ios/TonalCoach/Shared/StaggeredAppear.swift`

- [ ] **Step 1: Create StaggeredAppear.swift**

```swift
import SwiftUI

/// View modifier that fades + slides a view in with a staggered delay based on index.
/// Tracks animation state internally so it does not replay in Lazy* containers.
struct StaggeredAppear: ViewModifier {
    let index: Int
    let staggerInterval: Double

    @State private var hasAppeared = false

    func body(content: Content) -> some View {
        content
            .opacity(hasAppeared ? 1 : 0)
            .offset(y: hasAppeared ? 0 : 12)
            .onAppear {
                guard !hasAppeared else { return }
                let delay = Animate.staggerDelay(index: index, interval: staggerInterval)
                withAnimation(Animate.smooth.delay(delay)) {
                    hasAppeared = true
                }
            }
    }
}

extension View {
    /// Stagger this view's appearance. Use `index` for position in the list.
    /// Default interval is 60ms (card stagger).
    func staggeredAppear(index: Int, interval: Double = Animate.cardStagger) -> some View {
        modifier(StaggeredAppear(index: index, staggerInterval: interval))
    }
}
```

- [ ] **Step 2: Add file to Xcode project and verify build**

Run: `cd ios && xcodebuild -scheme TonalCoach -destination 'platform=iOS Simulator,name=iPhone 16 Pro' build 2>&1 | tail -5`
Expected: BUILD SUCCEEDED

- [ ] **Step 3: Commit**

```bash
git add ios/TonalCoach/Shared/StaggeredAppear.swift ios/TonalCoach.xcodeproj/
git commit -m "feat(ios): add StaggeredAppear view modifier for cascading reveals"
```

---

### Task 5: CountingText

**Files:**

- Create: `ios/TonalCoach/Shared/CountingText.swift`

- [ ] **Step 1: Create CountingText.swift**

```swift
import SwiftUI

/// Animates a number from 0 to `target` with an ease-out curve.
/// Uses Geist Mono with monospacedDigit for stable column alignment.
struct CountingText: View {
    let target: Double
    let format: String
    let duration: Double
    let font: Font

    @State private var startTime: Date?
    @State private var displayValue: Double = 0

    init(
        target: Double,
        format: String = "%.0f",
        duration: Double = Animate.dataViz + 0.1,
        font: Font = Theme.Typography.monoText
    ) {
        self.target = target
        self.format = format
        self.duration = duration
        self.font = font
    }

    var body: some View {
        Group {
            if Animate.prefersReducedMotion {
                Text(String(format: format, target))
            } else {
                TimelineView(.animation) { timeline in
                    let now = timeline.date
                    let elapsed = startTime.map { now.timeIntervalSince($0) } ?? 0
                    let progress = min(elapsed / duration, 1.0)
                    // Ease-out cubic: 1 - (1 - t)^3
                    let eased = 1.0 - pow(1.0 - progress, 3)
                    let value = target * eased
                    Text(String(format: format, value))
                }
            }
        }
        .font(font)
        .monospacedDigit()
        .onAppear {
            if startTime == nil {
                startTime = Date()
            }
        }
    }
}
```

- [ ] **Step 2: Add file to Xcode project and verify build**

Run: `cd ios && xcodebuild -scheme TonalCoach -destination 'platform=iOS Simulator,name=iPhone 16 Pro' build 2>&1 | tail -5`
Expected: BUILD SUCCEEDED

- [ ] **Step 3: Commit**

```bash
git add ios/TonalCoach/Shared/CountingText.swift ios/TonalCoach.xcodeproj/
git commit -m "feat(ios): add CountingText animated number display"
```

---

### Task 6: ShimmerView

**Files:**

- Create: `ios/TonalCoach/Shared/ShimmerView.swift`
- Modify: `ios/TonalCoach/Library/WorkoutCardView.swift` (remove old CardShimmerModifier)

- [ ] **Step 1: Create ShimmerView.swift**

Upgraded from the existing `CardShimmerModifier` in WorkoutCardView.swift (lines 129-149), with new timing (1.2s sweep, 0.4s pause):

```swift
import SwiftUI

/// Skeleton placeholder with a shimmer sweep animation.
struct ShimmerView: View {
    let height: CGFloat
    var width: CGFloat? = nil
    var cornerRadius: CGFloat = Theme.CornerRadius.md

    var body: some View {
        RoundedRectangle(cornerRadius: cornerRadius)
            .fill(Theme.Colors.muted.opacity(0.8))
            .frame(width: width, height: height)
            .shimmer()
    }
}

/// View modifier that applies a left-to-right shimmer sweep.
/// Duration: 1.2s sweep + 0.4s pause between sweeps.
struct ShimmerModifier: ViewModifier {
    @State private var phase: CGFloat = -1

    func body(content: Content) -> some View {
        content
            .overlay(
                LinearGradient(
                    colors: [.clear, Color.white.opacity(0.15), .clear],
                    startPoint: .leading,
                    endPoint: .trailing
                )
                .offset(x: phase * 300)
                .clipped()
            )
            .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.md))
            .onAppear {
                if Animate.prefersReducedMotion { return }
                withAnimation(
                    .linear(duration: 1.2)
                    .repeatForever(autoreverses: false)
                    .delay(0.4)
                ) {
                    phase = 1
                }
            }
    }
}

extension View {
    /// Apply shimmer animation to any skeleton placeholder.
    func shimmer() -> some View {
        modifier(ShimmerModifier())
    }
}
```

- [ ] **Step 2: Remove CardShimmerModifier from WorkoutCardView.swift**

Delete lines 129-154 (the `CardShimmerModifier` struct and the `.cardShimmer()` extension) from `WorkoutCardView.swift`.

- [ ] **Step 3: Update all call sites from `.cardShimmer()` to `.shimmer()`**

Search codebase for `.cardShimmer()`. Known usages:

- `WorkoutCardView.swift` line ~123: `WorkoutCardSkeleton` uses `.cardShimmer()`
- `ScheduleView.swift` line ~176: `ScheduleDayCardSkeleton` uses `.cardShimmer()`
- `LibraryHomeView.swift` line ~390: skeleton uses `.cardShimmer()`

Replace all with `.shimmer()`.

- [ ] **Step 4: Add file to Xcode project and verify build**

Run: `cd ios && xcodebuild -scheme TonalCoach -destination 'platform=iOS Simulator,name=iPhone 16 Pro' build 2>&1 | tail -5`
Expected: BUILD SUCCEEDED

- [ ] **Step 5: Commit**

```bash
git add ios/TonalCoach/Shared/ShimmerView.swift ios/TonalCoach/Library/WorkoutCardView.swift ios/TonalCoach/Schedule/ScheduleView.swift ios/TonalCoach/Library/LibraryHomeView.swift ios/TonalCoach.xcodeproj/
git commit -m "feat(ios): add ShimmerView, promote from CardShimmerModifier"
```

---

### Task 7: Theme Upgrades

**Files:**

- Modify: `ios/TonalCoach/Shared/Theme.swift`

- [ ] **Step 1: Add shadow to CardModifier**

In `Theme.swift`, update `CardModifier` (lines 328-338) to include the shadow. Current code:

```swift
struct CardModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .background(Colors.card)
            .overlay(
                RoundedRectangle(cornerRadius: CornerRadius.lg)
                    .stroke(Color.white.opacity(0.08), lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: CornerRadius.lg))
    }
}
```

Add shadow after `.clipShape`:

```swift
.shadow(color: .black.opacity(0.1), radius: 8, y: 4)
```

- [ ] **Step 2: Verify color token parity with web**

Check each color against the spec's OKLch targets. The existing hex values should already map correctly since they were derived from the web. Spot-check:

- `background` (#040509) should approximate oklch(0.115 0.012 265) - verify visually
- `card` (#0a0c11) should approximate oklch(0.155 0.012 265)
- `primary` (#00d5d6) should approximate oklch(0.78 0.154 195)

If any color is off, update the hex value. The web's `globals.css` is the source of truth.

- [ ] **Step 3: Add "today glow" modifier**

Add a new view modifier to Theme.swift for the schedule "today" card glow:

```swift
struct TodayGlowModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .overlay(
                RoundedRectangle(cornerRadius: CornerRadius.lg)
                    .stroke(Colors.primary.opacity(0.3), lineWidth: 1.5)
            )
            .shadow(color: Colors.primary.opacity(0.15), radius: 10, y: 0)
            .scaleEffect(1.01)
    }
}

extension View {
    func todayGlow() -> some View {
        modifier(TodayGlowModifier())
    }
}
```

- [ ] **Step 4: Verify build**

Run: `cd ios && xcodebuild -scheme TonalCoach -destination 'platform=iOS Simulator,name=iPhone 16 Pro' build 2>&1 | tail -5`
Expected: BUILD SUCCEEDED

- [ ] **Step 5: Commit**

```bash
git add ios/TonalCoach/Shared/Theme.swift
git commit -m "feat(ios): upgrade CardModifier with shadow, add todayGlow modifier"
```

---

## Session 2: Dashboard Transformation

### Task 8: AsyncCard Upgrade

**Files:**

- Modify: `ios/TonalCoach/Tonal/AsyncCard.swift`

- [ ] **Step 1: Add 3-phase content reveal to AsyncCard**

The existing `AsyncCard` (78 lines) shows a basic loading/error/content switch. Upgrade it to use the 3-phase transition: skeleton -> fade-out -> content slide-up.

Add state tracking for the reveal phase:

```swift
@State private var isRevealed = false
```

Replace the simple content switch with animated transitions. When `data` becomes non-nil, cross-fade skeleton out and slide content in:

```swift
// In the content case, wrap with:
content(data)
    .opacity(isRevealed ? 1 : 0)
    .offset(y: isRevealed ? 0 : 8)
    .onAppear {
        withAnimation(Animate.smooth) {
            isRevealed = true
        }
    }
```

Replace the loading view with `ShimmerView`-based skeleton placeholder (circular for rings, rectangular bars for lists).

- [ ] **Step 2: Verify build**

Run: `cd ios && xcodebuild -scheme TonalCoach -destination 'platform=iOS Simulator,name=iPhone 16 Pro' build 2>&1 | tail -5`
Expected: BUILD SUCCEEDED

- [ ] **Step 3: Commit**

```bash
git add ios/TonalCoach/Tonal/AsyncCard.swift
git commit -m "feat(ios): upgrade AsyncCard with 3-phase content reveal"
```

---

### Task 9: Dashboard Layout + Greeting + Coach CTA

**Files:**

- Modify: `ios/TonalCoach/Tonal/TonalDashboardView.swift`

- [ ] **Step 1: Add greeting header**

Above the first AsyncCard in the VStack, add:

```swift
// Greeting header
VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
    Text(greetingText)
        .font(Theme.Typography.title)
        .fontWeight(.bold)
        .kerning(-0.5)
        .foregroundColor(Theme.Colors.foreground)
    Text(dateText)
        .font(Theme.Typography.callout)
        .foregroundColor(Theme.Colors.mutedForeground)
}
.frame(maxWidth: .infinity, alignment: .leading)
```

Add computed properties for `greetingText` (based on hour: morning/afternoon/evening) and `dateText` (formatted current date).

- [ ] **Step 2: Add coach CTA banner**

Below the greeting, add a tappable banner:

```swift
Button {
    // Navigate to chat tab
} label: {
    HStack(spacing: Theme.Spacing.sm) {
        Image(systemName: "sparkles")
            .font(.system(size: 16, weight: .semibold))
        Text("Ask your coach about today's plan")
            .font(Theme.Typography.callout)
    }
    .foregroundColor(Theme.Colors.primary.opacity(0.8))
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding(Theme.Spacing.lg)
    .background(Theme.Colors.primary.opacity(0.1))
    .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.lg))
}
.pressableCard()
```

Pass a tab selection binding to navigate to `.chat` on tap.

- [ ] **Step 3: Apply staggered appear to all cards**

Wrap each card (greeting, CTA, + 5 AsyncCards) with `.staggeredAppear(index: N)` where N is 0, 1, 2... in order.

- [ ] **Step 4: Add refresh haptic**

Add `.sensoryFeedback(.impact(flexibility: .solid, intensity: 0.6), trigger: refreshID)` to the ScrollView (iOS 17+).

- [ ] **Step 5: Verify build**

Run: `cd ios && xcodebuild -scheme TonalCoach -destination 'platform=iOS Simulator,name=iPhone 16 Pro' build 2>&1 | tail -5`
Expected: BUILD SUCCEEDED

- [ ] **Step 6: Commit**

```bash
git add ios/TonalCoach/Tonal/TonalDashboardView.swift
git commit -m "feat(ios): add dashboard greeting, coach CTA, staggered card reveals"
```

---

### Task 10: Strength Score Card Animation

**Files:**

- Modify: `ios/TonalCoach/Tonal/StrengthScoreCard.swift`

- [ ] **Step 1: Add score-based ring color**

In the `ScoreRing` struct (lines 74-111), add a computed property:

```swift
private var ringColor: Color {
    let pct = score / maxScore
    if pct >= 0.7 { return Theme.Colors.primary }
    if pct >= 0.4 { return Theme.Colors.chart5 }
    return Theme.Colors.chart4
}
```

Replace the hardcoded `Theme.Colors.primary` on the progress circle (line 97) with `ringColor`.

- [ ] **Step 2: Add animated ring fill**

Add `@State private var animatedProgress: Double = 0` to ScoreRing. On `.onAppear`, animate from 0 to the target:

```swift
.onAppear {
    withAnimation(Animate.gentle) {
        animatedProgress = min(score / maxScore, 1.0)
    }
}
```

Use `animatedProgress` in `.trim(from: 0, to: animatedProgress)` instead of the direct calculation.

- [ ] **Step 3: Replace center score text with CountingText**

Replace the static `Text("\(Int(score))")` center label with:

```swift
CountingText(target: score, format: "%.0f")
    .font(Theme.Typography.monoText)
    .fontWeight(.bold)
    .foregroundColor(Theme.Colors.foreground)
```

- [ ] **Step 4: Add inner glow to ring**

Add an overlay shadow inside the ring frame:

```swift
.shadow(color: ringColor.opacity(0.3), radius: 10)
```

- [ ] **Step 5: Update ring sizes to spec**

Verify overall ring is 96pt with 10pt stroke, region rings are 64pt. Adjust `size` and `lineWidth` parameters in the card's call sites.

- [ ] **Step 6: Verify build**

Run: `cd ios && xcodebuild -scheme TonalCoach -destination 'platform=iOS Simulator,name=iPhone 16 Pro' build 2>&1 | tail -5`
Expected: BUILD SUCCEEDED

- [ ] **Step 7: Commit**

```bash
git add ios/TonalCoach/Tonal/StrengthScoreCard.swift
git commit -m "feat(ios): animate strength rings with score-based colors and counting text"
```

---

### Task 11: Muscle Readiness Card

**Files:**

- Modify: `ios/TonalCoach/Tonal/MuscleReadinessCard.swift`

- [ ] **Step 1: Fix readiness thresholds to match web**

In MuscleCell (line ~50-58), replace the existing thresholds:

```swift
// OLD: > 80 green, > 60 yellow, else red
// NEW: match web's MuscleReadinessMap.tsx
private var statusColor: Color {
    let value = readiness
    if value <= 30 { return Color(hex: "#f87171") }  // rose-400 (fatigued)
    if value <= 60 { return Color(hex: "#fbbf24") }  // amber-400 (recovering)
    return Color(hex: "#34d399")                       // emerald-400 (ready)
}

private var statusBackground: Color {
    let value = readiness
    if value <= 30 { return Color(hex: "#f87171").opacity(0.1) }
    if value <= 60 { return Color(hex: "#fbbf24").opacity(0.1) }
    return Color(hex: "#34d399").opacity(0.1)
}
```

- [ ] **Step 2: Apply semantic background tint to cells**

Update MuscleCell to use the `statusBackground` as the cell background, with `statusColor` for the indicator and text.

- [ ] **Step 3: Add staggered appear to cells**

In the `ForEach` loop of the grid, add `.staggeredAppear(index: index, interval: Animate.cellStagger)` to each `MuscleCell`.

- [ ] **Step 4: Verify build**

Run: `cd ios && xcodebuild -scheme TonalCoach -destination 'platform=iOS Simulator,name=iPhone 16 Pro' build 2>&1 | tail -5`
Expected: BUILD SUCCEEDED

- [ ] **Step 5: Commit**

```bash
git add ios/TonalCoach/Tonal/MuscleReadinessCard.swift
git commit -m "fix(ios): correct readiness thresholds to match web, add semantic colors and stagger"
```

---

### Task 12: Training Frequency Animated Bars

**Files:**

- Modify: `ios/TonalCoach/Tonal/TrainingFrequencyCard.swift`

- [ ] **Step 1: Add animated bar width**

In `frequencyRow`, add `@State private var barWidth: CGFloat = 0` and animate it on appear:

Replace the current static GeometryReader bar with an animated version:

```swift
GeometryReader { geo in
    Capsule()
        .fill(Theme.Colors.muted.opacity(0.5))
        .frame(height: 8)
        .overlay(alignment: .leading) {
            Capsule()
                .fill(color)
                .frame(width: barWidth, height: 8)
        }
        .onAppear {
            let target = geo.size.width * proportion
            let delay = Animate.staggerDelay(index: index, interval: Animate.barStagger)
            withAnimation(Animate.gentle.delay(delay)) {
                barWidth = target
            }
        }
}
.frame(height: 8)
```

Pass `index` through to the row for stagger computation.

- [ ] **Step 2: Use monospacedDigit for count labels**

Add `.monospacedDigit()` to the count text.

- [ ] **Step 3: Verify build**

Run: `cd ios && xcodebuild -scheme TonalCoach -destination 'platform=iOS Simulator,name=iPhone 16 Pro' build 2>&1 | tail -5`
Expected: BUILD SUCCEEDED

- [ ] **Step 4: Commit**

```bash
git add ios/TonalCoach/Tonal/TrainingFrequencyCard.swift
git commit -m "feat(ios): animate training frequency bars with cascade stagger"
```

---

### Task 13: Recent Workouts Card Stagger

**Files:**

- Modify: `ios/TonalCoach/Tonal/RecentWorkoutsCard.swift`

- [ ] **Step 1: Add staggered appear to workout rows**

In the `ForEach` loop (lines 13-18), add `.staggeredAppear(index: index, interval: Animate.rowStagger)` to each `WorkoutRow`.

- [ ] **Step 2: Add session type color dot**

In `WorkoutRow`, add an 8pt circle filled with the session type color at the leading edge, replacing or supplementing the current 3pt left border.

- [ ] **Step 3: Verify build and commit**

```bash
git add ios/TonalCoach/Tonal/RecentWorkoutsCard.swift
git commit -m "feat(ios): add staggered rows and session color dots to recent workouts"
```

---

## Session 3: Chat Transformation

### Task 14: Message Bubble Polish

**Files:**

- Modify: `ios/TonalCoach/Chat/MessageBubble.swift`

- [ ] **Step 1: Update corner radii to match web**

Replace the existing `userBubbleShape` (lines 210-217) and `coachBubbleShape` (lines 220-227):

```swift
// User: 24pt all corners except 6pt top-right (matches web rounded-2xl rounded-tr-sm)
private var userBubbleShape: UnevenRoundedRectangle {
    UnevenRoundedRectangle(
        topLeadingRadius: 24, bottomLeadingRadius: 24,
        bottomTrailingRadius: 24, topTrailingRadius: 6
    )
}

// Coach: 24pt all corners except 6pt top-left
private var coachBubbleShape: UnevenRoundedRectangle {
    UnevenRoundedRectangle(
        topLeadingRadius: 6, bottomLeadingRadius: 24,
        bottomTrailingRadius: 24, topTrailingRadius: 24
    )
}
```

- [ ] **Step 2: Add appear animations**

Add `@State private var hasAppeared = false` to MessageBubble. In `onAppear`:

For user messages: slide from right + fade

```swift
.opacity(hasAppeared ? 1 : 0)
.offset(x: hasAppeared ? 0 : 12)
.onAppear {
    guard !hasAppeared else { return }
    withAnimation(Animate.snappy) { hasAppeared = true }
}
```

For coach messages: slide up + fade

```swift
.opacity(hasAppeared ? 1 : 0)
.offset(y: hasAppeared ? 0 : 6)
.onAppear {
    guard !hasAppeared else { return }
    withAnimation(Animate.smooth) { hasAppeared = true }
}
```

- [ ] **Step 3: Add sender-proximity grouping support**

Add a `isGroupedWithPrevious: Bool` parameter to MessageBubble. When true:

- Hide the coach avatar (replace with equal-width spacer)
- Use 4pt spacing (the parent ChatView will control VStack spacing per-message)

- [ ] **Step 4: Verify build**

Run: `cd ios && xcodebuild -scheme TonalCoach -destination 'platform=iOS Simulator,name=iPhone 16 Pro' build 2>&1 | tail -5`
Expected: BUILD SUCCEEDED

- [ ] **Step 5: Commit**

```bash
git add ios/TonalCoach/Chat/MessageBubble.swift
git commit -m "feat(ios): polish message bubbles with web-matched radii and appear animations"
```

---

### Task 15: Chat Grouping Logic

**Files:**

- Modify: `ios/TonalCoach/Chat/ChatView.swift`

- [ ] **Step 1: Add sender-proximity grouping**

In `ChatView.swift`, within the existing date-based `groupedMessages` computed property, add sender-proximity detection. For each message in a date group, compute `isGroupedWithPrevious`:

```swift
/// True if same sender as previous message AND within 2 minutes
func isGroupedWithPrevious(_ message: ChatMessage, previous: ChatMessage?) -> Bool {
    guard let prev = previous else { return false }
    guard message.role == prev.role else { return false }
    let timeDiff = abs(message.creationTime - prev.creationTime)
    return timeDiff < 120 // 2 minutes in seconds
}
```

Pass this to each `MessageBubble` in the ForEach. Use it to control spacing (4pt vs 12pt gap between messages).

- [ ] **Step 2: Add stagger to suggestion chips**

In the empty state chip grid (lines 79-123), add `.staggeredAppear(index: chipIndex, interval: Animate.chipStagger)` to each chip.

- [ ] **Step 3: Verify build and commit**

```bash
git add ios/TonalCoach/Chat/ChatView.swift
git commit -m "feat(ios): add sender-proximity grouping and chip stagger to chat"
```

---

### Task 16: ThinkingIndicator Match Web

**Files:**

- Modify: `ios/TonalCoach/Chat/ThinkingIndicator.swift`

- [ ] **Step 1: Update dot animation to match web timing**

The web uses: opacity 0.3/scale 0.85 -> 1.0/1.0, with 200ms stagger, 1.4s total cycle.

Replace the current animation (lines 18-30) with:

```swift
ForEach(0..<3, id: \.self) { index in
    Circle()
        .frame(width: 6, height: 6)
        .foregroundColor(Theme.Colors.mutedForeground)
        .opacity(isAnimating ? 1.0 : 0.3)
        .scaleEffect(isAnimating ? 1.0 : 0.85)
        .animation(
            .easeInOut(duration: 0.7)
            .repeatForever(autoreverses: true)
            .delay(Double(index) * 0.2),
            value: isAnimating
        )
}
```

Note: dot size changed from 8pt to 6pt per spec.

- [ ] **Step 2: Verify build and commit**

```bash
git add ios/TonalCoach/Chat/ThinkingIndicator.swift
git commit -m "feat(ios): match thinking indicator to web timing and dot size"
```

---

### Task 17: Tool Approval Card Animation

**Files:**

- Modify: `ios/TonalCoach/Chat/ToolApprovalCard.swift`

- [ ] **Step 1: Add slide-in animation**

Add `@State private var hasAppeared = false` and animate on appear:

```swift
.opacity(hasAppeared ? 1 : 0)
.offset(y: hasAppeared ? 0 : 12)
.onAppear {
    guard !hasAppeared else { return }
    withAnimation(Animate.smooth) { hasAppeared = true }
}
```

- [ ] **Step 2: Add collapse after resolution**

When status changes to `.approved` or `.denied`, animate the card to a compact single-line summary:

```swift
// Replace the existing approved/denied case (lines 106-110) with:
if status == .approved {
    HStack(spacing: Theme.Spacing.sm) {
        Image(systemName: "checkmark.circle.fill")
            .foregroundColor(Theme.Colors.success)
        Text("Approved: \(toolDisplayName)")
            .font(Theme.Typography.caption)
            .foregroundColor(Theme.Colors.mutedForeground)
    }
    .transition(.asymmetric(insertion: .scale.combined(with: .opacity), removal: .opacity))
}
```

Wrap the status switch in an animation block that triggers on status change.

- [ ] **Step 3: Add shadow to approve button**

On the approve button, add: `.shadow(color: Theme.Colors.success.opacity(0.2), radius: 4, y: 2)`

- [ ] **Step 4: Verify build and commit**

```bash
git add ios/TonalCoach/Chat/ToolApprovalCard.swift
git commit -m "feat(ios): add slide-in and collapse animations to tool approval cards"
```

---

### Task 18: Streaming Text + Cursor Animation

**Files:**

- Modify: `ios/TonalCoach/Chat/MessageBubble.swift`

- [ ] **Step 1: Update streaming cursor to match spec**

Replace the existing `StreamingCursor` (lines 233-249) with a softer pulse that matches the spec:

```swift
struct StreamingCursor: View {
    @State private var opacity: Double = 1.0

    var body: some View {
        Text("|")
            .foregroundColor(Theme.Colors.primary)
            .opacity(opacity)
            .onAppear {
                withAnimation(
                    .easeInOut(duration: 0.5)
                    .repeatForever(autoreverses: true)
                ) {
                    opacity = 0.4
                }
            }
    }
}
```

This changes the cursor from a blinking pipe (on/off) to a soft pulse (1.0 -> 0.4) matching the spec's "soft cursor pulse at streaming end."

- [ ] **Step 2: Verify build and commit**

```bash
git add ios/TonalCoach/Chat/MessageBubble.swift
git commit -m "feat(ios): update streaming cursor to soft pulse animation"
```

---

### Task 19: Image Message Fullscreen

**Files:**

- Modify: `ios/TonalCoach/Chat/MessageBubble.swift`

- [ ] **Step 1: Add @Namespace and fullscreen state**

Add to MessageBubble:

```swift
@Namespace private var imageNamespace
@State private var selectedImageURL: URL?
```

- [ ] **Step 2: Update image thumbnails with matched geometry and styling**

In the image grid section (lines 149-175), update each thumbnail:

```swift
AsyncImage(url: url) { image in
    image
        .resizable()
        .aspectRatio(contentMode: .fill)
        .frame(width: 120, height: 120)
        .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.md))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.CornerRadius.md)
                .stroke(Color.white.opacity(0.08), lineWidth: 1)
        )
        .matchedGeometryEffect(id: url, in: imageNamespace)
        .onTapGesture { selectedImageURL = url }
} placeholder: {
    ShimmerView(height: 120, width: 120)
}
```

- [ ] **Step 3: Add fullscreen overlay**

Add a `.fullScreenCover` on the MessageBubble body:

```swift
.fullScreenCover(item: $selectedImageURL) { url in
    ZStack {
        Color.black.opacity(0.9).ignoresSafeArea()
        AsyncImage(url: url) { image in
            image
                .resizable()
                .aspectRatio(contentMode: .fit)
                .matchedGeometryEffect(id: url, in: imageNamespace)
        } placeholder: {
            ProgressView()
        }
    }
    .onTapGesture { selectedImageURL = nil }
}
```

Note: Full pinch-to-zoom and velocity-based swipe dismiss are stretch goals. Start with tap-to-dismiss for MVP, add gesture refinements if time allows.

- [ ] **Step 4: Make URL conform to Identifiable for .fullScreenCover(item:)**

Add an extension if needed:

```swift
extension URL: @retroactive Identifiable {
    public var id: String { absoluteString }
}
```

- [ ] **Step 5: Verify build and commit**

```bash
git add ios/TonalCoach/Chat/MessageBubble.swift
git commit -m "feat(ios): add image fullscreen with matched geometry transition"
```

---

### Task 20: Chat Input Bar Polish

**Files:**

- Modify: `ios/TonalCoach/Chat/ChatInputBar.swift`

- [ ] **Step 1: Animate send button appearance**

When `canSend` becomes true, the send button should scale from 0.9 to 1.0:

```swift
Image(systemName: "arrow.up.circle.fill")
    .font(.system(size: 30))
    .foregroundColor(canSend ? Theme.Colors.primary : Theme.Colors.tertiaryForeground)
    .scaleEffect(canSend ? 1.0 : 0.9)
    .animation(Animate.snappy, value: canSend)
```

- [ ] **Step 2: Add focus border transition**

On the text field's border, transition from `Color.white.opacity(0.08)` to `Theme.Colors.primary.opacity(0.3)` based on `isTextFieldFocused`:

```swift
.overlay(
    RoundedRectangle(cornerRadius: 20)
        .stroke(
            isTextFieldFocused ? Theme.Colors.primary.opacity(0.3) : Color.white.opacity(0.08),
            lineWidth: 1
        )
        .animation(.easeInOut(duration: Animate.standard), value: isTextFieldFocused)
)
```

- [ ] **Step 3: Verify build and commit**

```bash
git add ios/TonalCoach/Chat/ChatInputBar.swift
git commit -m "feat(ios): polish chat input bar with send button animation and focus border"
```

---

## Session 4: Remaining Screens

### Task 21: Schedule View Polish

**Files:**

- Modify: `ios/TonalCoach/Schedule/ScheduleView.swift`

- [ ] **Step 1: Apply today glow to current day card**

In the day list ForEach, conditionally apply `.todayGlow()` to the card for today's date:

```swift
.modifier(day.isToday ? TodayGlowModifier() : /* identity */)
```

If the `ScheduleDay` model doesn't have an `isToday` property, add one by comparing `day.date` to the current date.

- [ ] **Step 2: Add staggered appear to day cards**

Add `.staggeredAppear(index: index)` to each day card in the ForEach.

- [ ] **Step 3: Apply past day opacity**

For days in the past, add `.opacity(0.6)`.

- [ ] **Step 4: Add stagger to DayDetailView exercise rows**

In `DayDetailView.swift`, add `.staggeredAppear(index: index, interval: Animate.cellStagger)` to each exercise row.

- [ ] **Step 5: Verify build and commit**

```bash
git add ios/TonalCoach/Schedule/ScheduleView.swift ios/TonalCoach/Schedule/DayDetailView.swift
git commit -m "feat(ios): add today glow, stagger, and past opacity to schedule"
```

---

### Task 22: Library Polish

**Files:**

- Modify: `ios/TonalCoach/Library/LibraryHomeView.swift`
- Modify: `ios/TonalCoach/Library/WorkoutDetailView.swift`

- [ ] **Step 1: Apply pressableCard to workout cards**

In LibraryHomeView, ensure all tappable workout cards use `.pressableCard()` button style.

- [ ] **Step 2: Add hero image settle to WorkoutDetailView**

In WorkoutDetailView, add a subtle scale-down animation on the hero image:

```swift
@State private var imageSettled = false

// On the hero image:
.scaleEffect(imageSettled ? 1.0 : 1.02)
.opacity(imageSettled ? 1.0 : 0.8)
.onAppear {
    withAnimation(Animate.gentle) {
        imageSettled = true
    }
}
```

- [ ] **Step 3: Verify build and commit**

```bash
git add ios/TonalCoach/Library/LibraryHomeView.swift ios/TonalCoach/Library/WorkoutDetailView.swift
git commit -m "feat(ios): add press states and hero settle to library"
```

---

### Task 23: Tab Bar + Onboarding Polish

**Files:**

- Modify: `ios/TonalCoach/App/ContentView.swift`
- Modify: `ios/TonalCoach/Onboarding/TrainingOnboardingFlow.swift`
- Modify: `ios/TonalCoach/Onboarding/OnboardingReadyView.swift`

- [ ] **Step 1: Add tab icon scale animation**

In ContentView, track the selected tab and add a scale pulse on change. Use `.symbolEffect(.bounce, value: selectedTab)` on each tab's icon (iOS 17+), which gives the native bounce animation Apple uses.

- [ ] **Step 2: Add content cross-fade**

Wrap the TabView content in a container that applies `.animation(.easeInOut(duration: 0.15), value: selectedTab)` with `.transition(.opacity)`.

- [ ] **Step 3: Upgrade onboarding step transitions**

In `TrainingOnboardingFlow.swift`, replace any default transition with `.animation(Animate.smooth)` on the step view switching logic.

- [ ] **Step 4: Add stagger to OnboardingReadyView**

In `OnboardingReadyView.swift`, add `.staggeredAppear(index: N)` to each benefit list item (60ms interval). Add a gentle scale animation (0.9 -> 1.0) to the coach avatar on appear.

- [ ] **Step 5: Verify build and commit**

```bash
git add ios/TonalCoach/App/ContentView.swift ios/TonalCoach/Onboarding/TrainingOnboardingFlow.swift ios/TonalCoach/Onboarding/OnboardingReadyView.swift
git commit -m "feat(ios): polish tab bar, onboarding transitions, and ready screen"
```

---

### Task 24: Profile Screen Polish

**Files:**

- Modify: `ios/TonalCoach/Profile/ProfileView.swift`

- [ ] **Step 1: Add haptics to toggles**

For each `Toggle` in the profile settings, add `.onChange` with `HapticEngine.select()`:

```swift
Toggle("Notifications", isOn: $notificationsEnabled)
    .onChange(of: notificationsEnabled) { _, _ in
        HapticEngine.select()
    }
```

- [ ] **Step 2: Add destructive confirmation to sign out**

Replace the existing sign-out button tap action with a confirmation dialog:

```swift
.confirmationDialog("Sign Out", isPresented: $showSignOutConfirmation) {
    Button("Sign Out", role: .destructive) {
        HapticEngine.error()
        // existing sign out logic
    }
    Button("Cancel", role: .cancel) {}
} message: {
    Text("Are you sure you want to sign out?")
}
```

Trigger `HapticEngine.error()` before the sign-out action executes.

- [ ] **Step 3: Verify build and commit**

```bash
git add ios/TonalCoach/Profile/ProfileView.swift
git commit -m "feat(ios): add haptic feedback and sign-out confirmation to profile"
```

---

### Task 25: App Launch Choreography

**Files:**

- Modify: `ios/TonalCoach/App/TonalCoachApp.swift`

- [ ] **Step 1: Add launch-to-content transition**

Add `@State private var isLaunched = false` to the root view. Wrap the main content (whether login, onboarding, or content view) in:

```swift
Group {
    if isLaunched {
        // existing routing logic (login/onboarding/content)
    } else {
        // Splash: centered app icon or logo
        VStack {
            Image(systemName: "figure.strengthtraining.traditional")
                .font(.system(size: 48))
                .foregroundColor(Theme.Colors.primary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.Colors.background)
    }
}
.onAppear {
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
        withAnimation(Animate.smooth) {
            isLaunched = true
        }
    }
}
```

This gives a brief splash that cross-fades into the actual app content. The 0.3s delay is enough for the initial data load to start, so users see content (or skeleton) instead of a blank screen.

- [ ] **Step 2: Verify build and commit**

```bash
git add ios/TonalCoach/App/TonalCoachApp.swift
git commit -m "feat(ios): add launch-to-content cross-fade transition"
```

---

### Task 26: Final Verification

- [ ] **Step 1: Full build verification**

Run: `cd ios && xcodebuild -scheme TonalCoach -destination 'platform=iOS Simulator,name=iPhone 16 Pro' build 2>&1 | tail -10`
Expected: BUILD SUCCEEDED with 0 errors

- [ ] **Step 2: Visual walkthrough checklist**

Run the app in Simulator and verify each screen:

1. **Dashboard:** Greeting shows, coach CTA tappable, cards stagger in, rings animate with colors, bars cascade, readiness cells stagger with correct semantic colors
2. **Chat:** Suggestion chips stagger in, messages animate asymmetrically (user from right, coach from top), thinking dots match web timing, tool cards slide in and collapse, streaming cursor pulses softly, image tap opens fullscreen
3. **Schedule:** Today card glows, past cards dimmed, cards stagger, exercise rows stagger in detail
4. **Library:** Cards have press state, hero image settles
5. **Tabs:** Icon bounces on switch, haptic fires
6. **Onboarding:** Steps transition with smooth spring, ready screen staggers
7. **Profile:** Toggle haptics fire, sign-out shows confirmation
8. **Launch:** Splash cross-fades into content

- [ ] **Step 3: Reduce motion verification**

Enable Settings > Accessibility > Reduce Motion in Simulator. Verify:

- No stagger delays
- No spring animations (instant state changes)
- CountingText shows final value immediately
- Shimmer is static
- Haptics still fire

- [ ] **Step 4: Commit any remaining fixes**

```bash
git add -A
git commit -m "fix(ios): address visual polish issues from verification walkthrough"
```
