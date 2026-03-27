import SwiftUI

// MARK: - Slide Data

/// Content for a single welcome carousel slide.
private struct WelcomeSlide: Identifiable {
    let id: Int
    let icon: String
    let headline: String
    let subtitle: String
    /// Hue offset (in degrees) for the background gradient, creating visual variety per slide.
    let hueRotation: Double
}

private let slides: [WelcomeSlide] = [
    WelcomeSlide(
        id: 0,
        icon: "sparkles",
        headline: "Your AI Strength Coach",
        subtitle: "Personalized programming that adapts\nto your progress, goals, and recovery",
        hueRotation: 0
    ),
    WelcomeSlide(
        id: 1,
        icon: "dumbbell.fill",
        headline: "Custom Workouts on Tonal",
        subtitle: "AI-designed workouts pushed directly\nto your Tonal with one tap",
        hueRotation: 30
    ),
    WelcomeSlide(
        id: 2,
        icon: "chart.line.uptrend.xyaxis",
        headline: "Train Smarter, Not Harder",
        subtitle: "Strength scores, muscle readiness, and\ntraining insights from your data",
        hueRotation: 60
    ),
    WelcomeSlide(
        id: 3,
        icon: "figure.strengthtraining.traditional",
        headline: "Ready to Level Up?",
        subtitle: "Connect your Tonal and let the AI coach\nbuild your perfect program",
        hueRotation: 90
    ),
]

// MARK: - Welcome Carousel View

/// First-launch marketing carousel. Shows once per install, gated by `hasSeenWelcome` in AppStorage.
///
/// 4 full-screen slides with SF Symbol icons, gradient backgrounds, and swipeable navigation.
/// The last slide replaces the "Skip" button with a "Get Started" CTA.
struct WelcomeCarouselView: View {
    @AppStorage("hasSeenWelcome") private var hasSeenWelcome = false
    @State private var currentPage = 0

    private var isLastSlide: Bool { currentPage == slides.count - 1 }

    var body: some View {
        ZStack {
            // Background: dark base with per-slide gradient glow
            Theme.Colors.background
                .ignoresSafeArea()

            backgroundGlow
                .ignoresSafeArea()

            VStack(spacing: 0) {
                // Skip button (top-right, hidden on last slide)
                skipBar

                // Swipeable page content
                TabView(selection: $currentPage) {
                    ForEach(slides) { slide in
                        SlideContent(slide: slide)
                            .tag(slide.id)
                    }
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
                .animation(Animate.smooth, value: currentPage)

                // Custom page indicator + CTA
                bottomControls
                    .padding(.bottom, Theme.Spacing.xxxl)
            }
        }
        .preferredColorScheme(.dark)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Welcome to TonalCoach")
    }

    // MARK: - Background Glow

    /// Radial gradient that shifts hue per slide for visual differentiation.
    private var backgroundGlow: some View {
        RadialGradient(
            colors: [
                Theme.Colors.primary.opacity(0.15),
                Theme.Colors.primary.opacity(0.05),
                .clear,
            ],
            center: .center,
            startRadius: 20,
            endRadius: 400
        )
        .hueRotation(.degrees(slides[currentPage].hueRotation))
        .animation(Animate.smooth, value: currentPage)
    }

    // MARK: - Skip Bar

    private var skipBar: some View {
        HStack {
            Spacer()

            if !isLastSlide {
                Button {
                    dismiss()
                } label: {
                    Text("Skip")
                        .font(Theme.Typography.calloutMedium)
                        .foregroundStyle(Theme.Colors.textSecondary)
                        .padding(.horizontal, Theme.Spacing.lg)
                        .padding(.vertical, Theme.Spacing.sm)
                        .contentShape(Rectangle())
                }
                .accessibilityLabel("Skip welcome tour")
                .transition(.opacity)
            }
        }
        .frame(height: 44)
        .padding(.horizontal, Theme.Spacing.md)
        .animation(Animate.snappy, value: isLastSlide)
    }

    // MARK: - Bottom Controls

    private var bottomControls: some View {
        VStack(spacing: Theme.Spacing.xl) {
            // Page dots
            HStack(spacing: Theme.Spacing.sm) {
                ForEach(slides) { slide in
                    Circle()
                        .fill(
                            slide.id == currentPage
                                ? Theme.Colors.primary
                                : Theme.Colors.textTertiary
                        )
                        .frame(
                            width: slide.id == currentPage ? 10 : 8,
                            height: slide.id == currentPage ? 10 : 8
                        )
                        .animation(Animate.snappy, value: currentPage)
                }
            }
            .accessibilityLabel("Page \(currentPage + 1) of \(slides.count)")

            // Get Started button (last slide only)
            if isLastSlide {
                Button {
                    dismiss()
                } label: {
                    Text("Get Started")
                        .font(Theme.Typography.calloutMedium)
                        .foregroundStyle(Theme.Colors.primaryForeground)
                        .frame(maxWidth: .infinity)
                        .frame(height: 52)
                        .background(Theme.Colors.primary)
                        .clipShape(
                            RoundedRectangle(
                                cornerRadius: Theme.CornerRadius.md,
                                style: .continuous
                            )
                        )
                }
                .padding(.horizontal, Theme.Spacing.xl)
                .accessibilityLabel("Get started with TonalCoach")
                .transition(.opacity.combined(with: .move(edge: .bottom)))
            }
        }
        .animation(Animate.smooth, value: isLastSlide)
    }

    // MARK: - Actions

    private func dismiss() {
        Theme.Haptics.light()
        hasSeenWelcome = true
    }
}

// MARK: - Slide Content

/// Individual slide layout: icon with glow, headline, subtitle.
private struct SlideContent: View {
    let slide: WelcomeSlide

    @State private var iconAppeared = false

    var body: some View {
        VStack(spacing: Theme.Spacing.xl) {
            Spacer()

            // Icon with teal glow
            ZStack {
                // Glow behind icon
                Circle()
                    .fill(Theme.Colors.primary.opacity(0.12))
                    .frame(width: 120, height: 120)
                    .blur(radius: 30)

                Image(systemName: slide.icon)
                    .font(.system(size: 64, weight: .light))
                    .foregroundStyle(
                        LinearGradient(
                            colors: [
                                Theme.Colors.primary,
                                Theme.Colors.primary.opacity(0.7),
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .scaleEffect(iconAppeared ? 1.0 : 0.7)
                    .opacity(iconAppeared ? 1.0 : 0)
            }
            .frame(height: 120)
            .accessibilityHidden(true)

            VStack(spacing: Theme.Spacing.md) {
                Text(slide.headline)
                    .font(Theme.Typography.largeTitle)
                    .foregroundStyle(Theme.Colors.textPrimary)
                    .multilineTextAlignment(.center)

                Text(slide.subtitle)
                    .font(Theme.Typography.body)
                    .foregroundStyle(Theme.Colors.textSecondary)
                    .multilineTextAlignment(.center)
                    .lineSpacing(4)
            }
            .padding(.horizontal, Theme.Spacing.xl)

            Spacer()
            Spacer()
        }
        .onAppear {
            withAnimation(.easeOut(duration: 0.5).delay(0.1)) {
                iconAppeared = true
            }
        }
        .onDisappear {
            iconAppeared = false
        }
    }
}

// MARK: - Preview

#Preview("Welcome Carousel") {
    WelcomeCarouselView()
        .preferredColorScheme(.dark)
}
