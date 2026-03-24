import SwiftUI

/// Onboarding screen that explains notification benefits and requests permission.
///
/// Present during first launch or from settings when notifications are `.notDetermined`.
struct NotificationPermissionView: View {
    @Environment(\.notificationManager) private var notificationManager
    @Environment(\.dismiss) private var dismiss

    var onComplete: () -> Void = {}
    var onSkip: () -> Void = {}

    @State private var isRequesting = false

    var body: some View {
        VStack(spacing: Theme.Spacing.xl) {
            Spacer()

            icon
            heading
            benefitsList

            Spacer()

            buttons
        }
        .padding(.horizontal, Theme.Spacing.xl)
        .padding(.vertical, Theme.Spacing.xxl)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.Colors.background)
    }

    // MARK: - Subviews

    private var icon: some View {
        Image(systemName: "bell.badge.fill")
            .font(.system(size: 56))
            .foregroundStyle(Theme.Colors.primary)
            .padding(.bottom, Theme.Spacing.sm)
    }

    private var heading: some View {
        Text("Stay on Track")
            .font(Theme.Typography.largeTitle)
            .foregroundStyle(Theme.Colors.foreground)
            .multilineTextAlignment(.center)
    }

    private var benefitsList: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.lg) {
            benefitRow(
                icon: "clock.badge",
                text: "Workout reminders at your preferred time"
            )
            benefitRow(
                icon: "chart.bar.fill",
                text: "Weekly strength progress recaps"
            )
            benefitRow(
                icon: "brain.head.profile",
                text: "AI coach tips and suggestions"
            )
            benefitRow(
                icon: "checkmark.message.fill",
                text: "Post-workout check-ins"
            )
        }
        .padding(Theme.Spacing.lg)
        .background(Theme.Colors.card)
        .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.CornerRadius.lg, style: .continuous)
                .stroke(Theme.Colors.border, lineWidth: 1)
        )
    }

    private func benefitRow(icon: String, text: String) -> some View {
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

    private var buttons: some View {
        VStack(spacing: Theme.Spacing.md) {
            Button {
                Task { await enableNotifications() }
            } label: {
                HStack {
                    if isRequesting {
                        ProgressView()
                            .tint(Theme.Colors.primaryForeground)
                    }
                    Text("Enable Notifications")
                }
                .frame(maxWidth: .infinity)
                .primaryButtonStyle()
            }
            .disabled(isRequesting)

            Button {
                onSkip()
                dismiss()
            } label: {
                Text("Maybe Later")
                    .font(Theme.Typography.callout)
                    .foregroundStyle(Theme.Colors.mutedForeground)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, Theme.Spacing.md)
            }
        }
    }

    // MARK: - Actions

    private func enableNotifications() async {
        isRequesting = true
        defer { isRequesting = false }

        do {
            let granted = try await notificationManager.requestAuthorization()
            if granted {
                await MainActor.run {
                    notificationManager.registerForRemoteNotifications()
                }
            }
            onComplete()
            dismiss()
        } catch {
            print("[NotificationPermissionView] Authorization error: \(error.localizedDescription)")
            onComplete()
            dismiss()
        }
    }
}

#Preview {
    NotificationPermissionView()
        .preferredColorScheme(.dark)
}
