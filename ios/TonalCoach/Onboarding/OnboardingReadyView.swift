import Combine
import ConvexMobile
import SwiftUI

// MARK: - Onboarding Ready View

/// Step 3 of onboarding: a completion screen confirming the user is set up.
/// Offers navigation to Chat or Dashboard as the first destination.
struct OnboardingReadyView: View {
    let onComplete: (AppTab) -> Void

    @Environment(ConvexManager.self) private var convex

    @State private var firstName: String?
    @State private var cancellable: AnyCancellable?

    private var displayName: String {
        if let firstName, !firstName.isEmpty {
            return firstName
        }
        return "there"
    }

    // MARK: - Body

    var body: some View {
        ZStack {
            Theme.Colors.background
                .ignoresSafeArea()

            ScrollView {
                VStack(spacing: Theme.Spacing.xl) {
                    Spacer(minLength: Theme.Spacing.xxxl)

                    stepIndicator
                    coachAvatar
                    titleSection
                    benefitsList
                    actionButtons

                    Spacer(minLength: Theme.Spacing.xl)
                }
                .padding(.horizontal, Theme.Spacing.lg)
            }
        }
        .onAppear { loadUserName() }
    }

    // MARK: - Step Indicator

    private var stepIndicator: some View {
        VStack(spacing: Theme.Spacing.sm) {
            Text("Step 3 of 3")
                .font(Theme.Typography.caption)
                .foregroundStyle(Theme.Colors.textSecondary)

            HStack(spacing: Theme.Spacing.sm) {
                ForEach(1...3, id: \.self) { step in
                    Circle()
                        .fill(step <= 3 ? Theme.Colors.primary : Theme.Colors.tertiaryForeground)
                        .frame(width: 8, height: 8)
                }
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Step 3 of 3, complete")
    }

    // MARK: - Coach Avatar

    private var coachAvatar: some View {
        ZStack {
            RoundedRectangle(cornerRadius: Theme.CornerRadius.xl, style: .continuous)
                .fill(
                    LinearGradient(
                        colors: [Theme.Colors.primary, Theme.Colors.chart3],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(width: 64, height: 64)
                .shadow(color: Theme.Colors.primary.opacity(0.25), radius: 12, y: 4)

            Image(systemName: "sparkles")
                .font(.system(size: 28))
                .foregroundStyle(.white)
        }
        .accessibilityHidden(true)
    }

    // MARK: - Title Section

    private var titleSection: some View {
        VStack(spacing: Theme.Spacing.sm) {
            Text("You're all set, \(displayName)!")
                .font(Theme.Typography.title)
                .foregroundStyle(Theme.Colors.textPrimary)
                .multilineTextAlignment(.center)
                .accessibilityAddTraits(.isHeader)

            Text("Your coach is ready. Here's what you can do:")
                .font(Theme.Typography.callout)
                .foregroundStyle(Theme.Colors.textSecondary)
                .multilineTextAlignment(.center)
        }
    }

    // MARK: - Benefits List

    private var benefitsList: some View {
        VStack(spacing: Theme.Spacing.md) {
            benefitRow(icon: "sparkles", text: "AI-powered workout programming")
            benefitRow(icon: "chart.line.uptrend.xyaxis", text: "Training insights from your data")
            benefitRow(icon: "dumbbell.fill", text: "Custom workouts pushed to your Tonal")
        }
    }

    private func benefitRow(icon: String, text: String) -> some View {
        HStack(spacing: Theme.Spacing.md) {
            Image(systemName: icon)
                .font(.system(size: 16))
                .foregroundStyle(Theme.Colors.primary)
                .frame(width: 24, alignment: .center)

            Text(text)
                .font(Theme.Typography.callout)
                .foregroundStyle(Theme.Colors.textSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, Theme.Spacing.md)
        .padding(.vertical, Theme.Spacing.md)
        .background(Theme.Colors.primary.opacity(0.05))
        .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.md, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.CornerRadius.md, style: .continuous)
                .stroke(Theme.Colors.primary.opacity(0.1), lineWidth: 1)
        )
    }

    // MARK: - Action Buttons

    private var actionButtons: some View {
        VStack(spacing: Theme.Spacing.md) {
            Button {
                Theme.Haptics.success()
                onComplete(.chat)
            } label: {
                HStack(spacing: Theme.Spacing.sm) {
                    Image(systemName: "message.fill")
                        .font(.system(size: 16))

                    Text("Start Chatting")

                    Image(systemName: "arrow.right")
                        .font(.system(size: 14))
                }
                .font(Theme.Typography.calloutMedium)
                .foregroundStyle(Theme.Colors.primaryForeground)
                .frame(maxWidth: .infinity)
                .frame(height: 48)
                .background(Theme.Colors.primary)
                .clipShape(
                    RoundedRectangle(cornerRadius: Theme.CornerRadius.md, style: .continuous)
                )
            }
            .accessibilityLabel("Start chatting with your coach")

            Button {
                Theme.Haptics.light()
                onComplete(.dashboard)
            } label: {
                HStack(spacing: Theme.Spacing.sm) {
                    Image(systemName: "chart.bar.fill")
                        .font(.system(size: 16))

                    Text("Explore Dashboard")
                }
                .font(Theme.Typography.calloutMedium)
                .foregroundStyle(Theme.Colors.foreground)
                .frame(maxWidth: .infinity)
                .frame(height: 48)
                .background(Theme.Colors.card)
                .clipShape(
                    RoundedRectangle(cornerRadius: Theme.CornerRadius.md, style: .continuous)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.CornerRadius.md, style: .continuous)
                        .stroke(Theme.Colors.border, lineWidth: 1)
                )
            }
            .accessibilityLabel("Explore your dashboard")
        }
    }

    // MARK: - Data Loading

    private func loadUserName() {
        guard cancellable == nil else { return }
        cancellable = convex.client
            .subscribe(to: "users:getMe", yielding: UserInfo.self)
            .receive(on: DispatchQueue.main)
            .sink(
                receiveCompletion: { _ in },
                receiveValue: { info in
                    if let tonalName = info.tonalName {
                        // Parse first name from "Jeff Otano" -> "Jeff"
                        firstName = tonalName.components(separatedBy: " ").first
                    }
                }
            )
    }
}

// MARK: - Preview

#Preview("Onboarding Ready") {
    OnboardingReadyView(onComplete: { _ in })
        .environment(ConvexManager())
        .preferredColorScheme(.dark)
}
