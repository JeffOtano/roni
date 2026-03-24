import SwiftUI

/// Dashboard card listing external (non-Tonal) activities such as runs,
/// bike rides, and other tracked workouts from connected sources.
struct ExternalActivitiesCard: View {
    let activities: [TonalExternalActivity]

    var body: some View {
        if activities.isEmpty {
            emptyState
        } else {
            VStack(spacing: Theme.Spacing.sm) {
                ForEach(activities.prefix(5)) { activity in
                    ExternalActivityRow(activity: activity)
                }
            }
        }
    }

    private var emptyState: some View {
        Text("No external activities")
            .font(Theme.Typography.callout)
            .foregroundStyle(Theme.Colors.textTertiary)
            .frame(maxWidth: .infinity, minHeight: 60)
    }
}

// MARK: - Activity Row

private struct ExternalActivityRow: View {
    let activity: TonalExternalActivity

    var body: some View {
        HStack(spacing: Theme.Spacing.md) {
            Image(systemName: iconName)
                .font(.system(size: 20))
                .foregroundStyle(Theme.Colors.primary)
                .frame(width: 32, height: 32)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
                HStack {
                    Text(activity.workoutType)
                        .font(Theme.Typography.calloutMedium)
                        .foregroundStyle(Theme.Colors.textPrimary)
                        .lineLimit(1)

                    Spacer()

                    Text(activity.beginTime.relativeTime)
                        .font(Theme.Typography.caption)
                        .foregroundStyle(Theme.Colors.textSecondary)
                }

                HStack(spacing: Theme.Spacing.md) {
                    ExternalStatLabel(text: "\(Int(activity.activeDuration / 60))min")

                    if activity.activeCalories > 0 {
                        ExternalStatLabel(text: "\(Int(activity.activeCalories))cal")
                    }

                    if activity.averageHeartRate > 0 {
                        ExternalStatLabel(text: "\(Int(activity.averageHeartRate)) bpm")
                    }

                    Text(activity.source)
                        .font(Theme.Typography.caption)
                        .foregroundStyle(Theme.Colors.primary)
                        .padding(.horizontal, Theme.Spacing.sm)
                        .padding(.vertical, 2)
                        .background(Theme.Colors.primary.opacity(0.15))
                        .clipShape(
                            RoundedRectangle(cornerRadius: Theme.CornerRadius.sm, style: .continuous)
                        )
                }
            }
        }
        .padding(Theme.Spacing.sm)
        .background(Theme.Colors.muted)
        .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.sm, style: .continuous))
    }

    private var iconName: String {
        switch activity.workoutType.lowercased() {
        case let t where t.contains("run"):
            return "figure.run"
        case let t where t.contains("cycl") || t.contains("bik"):
            return "bicycle"
        case let t where t.contains("swim"):
            return "figure.pool.swim"
        case let t where t.contains("hik"):
            return "figure.hiking"
        case let t where t.contains("yoga"):
            return "figure.yoga"
        case let t where t.contains("row"):
            return "figure.rower"
        case let t where t.contains("walk"):
            return "figure.walk"
        case let t where t.contains("elliptical"):
            return "figure.elliptical"
        default:
            return "figure.strengthtraining.functional"
        }
    }
}

// MARK: - External Stat Label

private struct ExternalStatLabel: View {
    let text: String

    var body: some View {
        Text(text)
            .font(Theme.Typography.caption)
            .foregroundStyle(Theme.Colors.textSecondary)
    }
}
