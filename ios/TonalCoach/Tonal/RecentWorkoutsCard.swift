import SwiftUI

/// Dashboard card listing the most recent Tonal workouts (up to 5).
/// Each row shows a colored left border keyed to the target area,
/// the workout title, relative time, and key stats.
struct RecentWorkoutsCard: View {
    let workouts: [TonalActivity]

    var body: some View {
        if workouts.isEmpty {
            emptyState
        } else {
            VStack(spacing: Theme.Spacing.sm) {
                ForEach(workouts.prefix(5)) { workout in
                    WorkoutRow(activity: workout)
                }
            }
        }
    }

    private var emptyState: some View {
        Text("No recent workouts")
            .font(Theme.Typography.callout)
            .foregroundStyle(Theme.Colors.textTertiary)
            .frame(maxWidth: .infinity, minHeight: 60)
    }
}

// MARK: - Workout Row

private struct WorkoutRow: View {
    let activity: TonalActivity

    private var preview: WorkoutPreview { activity.workoutPreview }
    private var borderColor: Color {
        Theme.Colors.sessionTypeColor(preview.targetArea)
    }

    var body: some View {
        HStack(spacing: 0) {
            RoundedRectangle(cornerRadius: 1.5)
                .fill(borderColor)
                .frame(width: 3)

            VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
                HStack {
                    Text(preview.workoutTitle)
                        .font(Theme.Typography.calloutMedium)
                        .foregroundStyle(Theme.Colors.textPrimary)
                        .lineLimit(1)

                    Spacer()

                    Text(activity.activityTime.relativeTime)
                        .font(Theme.Typography.caption)
                        .foregroundStyle(Theme.Colors.textSecondary)
                }

                HStack(spacing: Theme.Spacing.md) {
                    Text(preview.targetArea.replacingOccurrences(of: "_", with: " ").capitalized)
                        .sessionBadgeStyle(for: preview.targetArea)

                    StatLabel(text: "\(Int(preview.totalVolume))lbs")
                    StatLabel(text: "\(Int(preview.totalDuration / 60))min")

                    if preview.totalAchievements > 0 {
                        StatLabel(
                            text: "\(Int(preview.totalAchievements)) PR\(preview.totalAchievements == 1 ? "" : "s")"
                        )
                    }
                }
            }
            .padding(.leading, Theme.Spacing.md)
        }
        .padding(Theme.Spacing.sm)
        .background(Theme.Colors.muted)
        .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.sm, style: .continuous))
    }
}

// MARK: - Stat Label

private struct StatLabel: View {
    let text: String

    var body: some View {
        Text(text)
            .font(Theme.Typography.caption)
            .foregroundStyle(Theme.Colors.textSecondary)
    }
}
