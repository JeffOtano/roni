import SwiftUI

// MARK: - Onboarding Step

/// The steps shown during first-launch onboarding.
private enum OnboardingStep: Int, CaseIterable {
    case welcome = 0
    case health = 1
    case notifications = 2
}

// MARK: - Onboarding View

/// First-launch onboarding flow with welcome, HealthKit, and notification permission steps.
///
/// Persists completion state via `@AppStorage("hasCompletedOnboarding")` so the flow
/// is only shown once. Each step can be completed or skipped.
struct OnboardingView: View {
    @AppStorage("hasCompletedOnboarding") private var hasCompletedOnboarding = false
    @State private var currentStep: OnboardingStep = .welcome

    var body: some View {
        ZStack {
            Theme.Colors.background
                .ignoresSafeArea()

            VStack(spacing: 0) {
                // Step content
                Group {
                    switch currentStep {
                    case .welcome:
                        welcomeStep

                    case .health:
                        HealthPermissionView(
                            onComplete: { advanceStep() },
                            onSkip: { advanceStep() }
                        )

                    case .notifications:
                        NotificationPermissionView(
                            onComplete: { completeOnboarding() },
                            onSkip: { completeOnboarding() }
                        )
                    }
                }
                .transition(.asymmetric(
                    insertion: .move(edge: .trailing).combined(with: .opacity),
                    removal: .move(edge: .leading).combined(with: .opacity)
                ))

                // Step indicator dots
                stepIndicator
                    .padding(.bottom, Theme.Spacing.xl)
            }
        }
        .animation(.easeInOut(duration: 0.3), value: currentStep)
    }

    // MARK: - Welcome Step

    private var welcomeStep: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(spacing: Theme.Spacing.xl) {
                    Spacer(minLength: Theme.Spacing.xxxl)

                    logo
                    tagline
                    featureHighlights

                    Spacer(minLength: Theme.Spacing.xl)
                }
                .padding(.horizontal, Theme.Spacing.lg)
            }

            getStartedButton
        }
    }

    private var logo: some View {
        Text("tonal.coach")
            .font(.system(size: 36, weight: .bold, design: .default))
            .foregroundStyle(Theme.Colors.primary)
    }

    private var tagline: some View {
        Text("AI-powered workouts for your Tonal")
            .font(Theme.Typography.callout)
            .foregroundStyle(Theme.Colors.textSecondary)
            .multilineTextAlignment(.center)
    }

    private var featureHighlights: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.lg) {
            featureRow(
                icon: "dumbbell.fill",
                text: "Browse 200+ expert workouts"
            )
            featureRow(
                icon: "arrow.up.right.square",
                text: "Open directly in Tonal"
            )
            featureRow(
                icon: "chart.line.uptrend.xyaxis",
                text: "Track your progress"
            )
        }
        .padding(Theme.Spacing.lg)
        .cardStyle()
    }

    private func featureRow(icon: String, text: String) -> some View {
        HStack(spacing: Theme.Spacing.md) {
            Image(systemName: icon)
                .font(.system(size: 20))
                .foregroundStyle(Theme.Colors.primary)
                .frame(width: 28, alignment: .center)

            Text(text)
                .font(Theme.Typography.callout)
                .foregroundStyle(Theme.Colors.foreground)
        }
    }

    private var getStartedButton: some View {
        VStack(spacing: Theme.Spacing.md) {
            Divider()
                .background(Theme.Colors.border)

            Button {
                advanceStep()
            } label: {
                Text("Get Started")
                    .frame(maxWidth: .infinity)
                    .primaryButtonStyle()
            }
        }
        .padding(.horizontal, Theme.Spacing.lg)
        .padding(.bottom, Theme.Spacing.lg)
    }

    // MARK: - Step Indicator

    private var stepIndicator: some View {
        HStack(spacing: Theme.Spacing.sm) {
            ForEach(OnboardingStep.allCases, id: \.rawValue) { step in
                Circle()
                    .fill(
                        step == currentStep
                            ? Theme.Colors.primary
                            : Theme.Colors.tertiaryForeground
                    )
                    .frame(width: 8, height: 8)
            }
        }
        .padding(.top, Theme.Spacing.lg)
    }

    // MARK: - Navigation

    private func advanceStep() {
        guard let nextStep = OnboardingStep(rawValue: currentStep.rawValue + 1) else {
            completeOnboarding()
            return
        }
        currentStep = nextStep
    }

    private func completeOnboarding() {
        hasCompletedOnboarding = true
    }
}

#Preview {
    OnboardingView()
        .preferredColorScheme(.dark)
}
