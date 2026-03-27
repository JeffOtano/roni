import HealthKit
import SwiftUI

// MARK: - Health Permission View

/// Onboarding view that explains HealthKit data usage and requests authorization.
///
/// Shown before the user has connected Apple Health. Provides a clear explanation
/// of what data we read and why, with a prominent connect button and a skip option.
struct HealthPermissionView: View {
    @Environment(\.healthKitManager) private var healthManager
    @Environment(\.dismiss) private var dismiss

    var onComplete: () -> Void = {}
    var onSkip: () -> Void = {}

    @State private var isRequesting = false
    @State private var showError = false
    @State private var errorText = ""

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(spacing: Theme.Spacing.xl) {
                    headerSection
                    dataTypesSection
                    privacySection
                }
                .padding(.horizontal, Theme.Spacing.lg)
                .padding(.top, Theme.Spacing.xxl)
                .padding(.bottom, Theme.Spacing.lg)
            }

            actionButtons
        }
        .background(Theme.Colors.background)
        .alert("Health Access Error", isPresented: $showError) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(errorText)
        }
    }

    // MARK: - Header

    private var headerSection: some View {
        VStack(spacing: Theme.Spacing.md) {
            ZStack {
                Circle()
                    .fill(Theme.Colors.primary.opacity(0.1))
                    .frame(width: 80, height: 80)
                Image(systemName: "heart.text.square.fill")
                    .font(.system(size: 36))
                    .foregroundStyle(Theme.Colors.primary)
            }

            Text("Connect Apple Health")
                .font(Theme.Typography.largeTitle)
                .foregroundStyle(Theme.Colors.foreground)

            Text(
                "TonalCoach can read your health data to give you a complete picture of your training alongside your Tonal workouts."
            )
            .font(Theme.Typography.callout)
            .foregroundStyle(Theme.Colors.textSecondary)
            .multilineTextAlignment(.center)
            .padding(.horizontal, Theme.Spacing.lg)
        }
    }

    // MARK: - Data Types

    private var dataTypesSection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text("What we read")
                .font(Theme.Typography.headline)
                .foregroundStyle(Theme.Colors.foreground)
                .padding(.bottom, Theme.Spacing.xs)

            DataTypeRow(
                icon: "flame.fill",
                color: Theme.Colors.success,
                title: "Active Energy",
                description: "Track calories burned throughout the day"
            )
            DataTypeRow(
                icon: "figure.run",
                color: Theme.Colors.primary,
                title: "Exercise Minutes",
                description: "Monitor daily exercise time toward your goal"
            )
            DataTypeRow(
                icon: "figure.stand",
                color: Theme.Colors.destructive,
                title: "Stand Hours",
                description: "See your daily movement breaks"
            )
            DataTypeRow(
                icon: "heart.fill",
                color: Theme.Colors.chart4,
                title: "Heart Rate",
                description: "Resting and workout heart rate trends"
            )
            DataTypeRow(
                icon: "dumbbell.fill",
                color: Theme.Colors.warning,
                title: "Workouts",
                description: "View Tonal and other workout history"
            )
            DataTypeRow(
                icon: "scalemass.fill",
                color: Theme.Colors.chart2,
                title: "Body Weight",
                description: "Track weight trends for strength context"
            )

            if healthManager.isAuthorized {
                HStack(spacing: Theme.Spacing.sm) {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(Theme.Colors.success)
                    Text("Connected to Apple Health")
                        .font(Theme.Typography.calloutMedium)
                        .foregroundStyle(Theme.Colors.success)
                }
                .padding(.top, Theme.Spacing.md)
            }
        }
        .padding(Theme.Spacing.lg)
        .cardStyle()
    }

    // MARK: - Privacy

    private var privacySection: some View {
        HStack(alignment: .top, spacing: Theme.Spacing.md) {
            Image(systemName: "lock.shield.fill")
                .font(.title3)
                .foregroundStyle(Theme.Colors.textTertiary)
            VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
                Text("Your data stays private")
                    .font(Theme.Typography.calloutMedium)
                    .foregroundStyle(Theme.Colors.foreground)
                Text(
                    "TonalCoach only reads health data -- we never write or modify it. Data is processed on your device and not shared with third parties."
                )
                .font(Theme.Typography.caption)
                .foregroundStyle(Theme.Colors.textSecondary)
            }
        }
        .padding(Theme.Spacing.lg)
        .cardStyle()
    }

    // MARK: - Action Buttons

    private var actionButtons: some View {
        VStack(spacing: Theme.Spacing.md) {
            Divider()
                .background(Theme.Colors.border)

            if healthManager.isAuthorized {
                Button {
                    onComplete()
                    dismiss()
                } label: {
                    Text("Continue")
                        .frame(maxWidth: .infinity)
                        .primaryButtonStyle()
                }
            } else {
                Button {
                    requestAccess()
                } label: {
                    HStack(spacing: Theme.Spacing.sm) {
                        if isRequesting {
                            ProgressView()
                                .tint(Theme.Colors.primaryForeground)
                        }
                        Text("Connect Apple Health")
                    }
                    .frame(maxWidth: .infinity)
                    .primaryButtonStyle()
                }
                .disabled(isRequesting)

                Button {
                    onSkip()
                    dismiss()
                } label: {
                    Text("Skip for Now")
                        .font(Theme.Typography.calloutMedium)
                        .foregroundStyle(Theme.Colors.textSecondary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, Theme.Spacing.md)
                }
            }
        }
        .padding(.horizontal, Theme.Spacing.lg)
        .padding(.bottom, Theme.Spacing.lg)
    }

    // MARK: - Actions

    private func requestAccess() {
        guard !isRequesting else { return }
        isRequesting = true

        Task {
            do {
                try await healthManager.requestAuthorization()
                await MainActor.run {
                    isRequesting = false
                    if healthManager.isAuthorized {
                        onComplete()
                        dismiss()
                    }
                }
            } catch {
                await MainActor.run {
                    isRequesting = false
                    errorText = error.localizedDescription
                    showError = true
                }
            }
        }
    }
}

// MARK: - Data Type Row

/// A single row showing a data type with icon, title, and description.
private struct DataTypeRow: View {
    let icon: String
    let color: Color
    let title: String
    let description: String

    var body: some View {
        HStack(alignment: .top, spacing: Theme.Spacing.md) {
            Image(systemName: icon)
                .font(.body)
                .foregroundStyle(color)
                .frame(width: 24, height: 24)

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(Theme.Typography.calloutMedium)
                    .foregroundStyle(Theme.Colors.foreground)
                Text(description)
                    .font(Theme.Typography.caption)
                    .foregroundStyle(Theme.Colors.textSecondary)
            }

            Spacer()
        }
        .padding(.vertical, Theme.Spacing.xs)
    }
}
