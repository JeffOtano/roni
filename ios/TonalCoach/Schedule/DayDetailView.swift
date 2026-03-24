import SwiftUI

// MARK: - Day Detail View

/// Full detail screen for a training day, showing all exercises with sets/reps.
///
/// Pushed via `NavigationLink(value: ScheduleDay.self)` from ScheduleView.
struct DayDetailView: View {
    let day: ScheduleDay

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Spacing.lg) {
                headerSection
                statsRow
                divider
                exerciseList

                if let tonalId = day.tonalWorkoutId,
                   day.derivedStatus == "programmed"
                {
                    openInTonalButton(tonalId)
                }
            }
            .padding(Theme.Spacing.lg)
        }
        .background(Theme.Colors.background)
        .navigationTitle(day.dayName)
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: - Header

    private var headerSection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            // Day name + full date
            Text(fullDateString)
                .font(Theme.Typography.callout)
                .foregroundStyle(Theme.Colors.textSecondary)

            // Session type badge + status badge
            HStack(spacing: Theme.Spacing.sm) {
                Text(WorkoutLabels.sessionTypeLabel(day.sessionType))
                    .sessionBadgeStyle(for: day.sessionType)
                StatusBadgeView(status: day.derivedStatus)
            }

            // Workout title
            if let title = day.workoutTitle {
                Text(title)
                    .font(Theme.Typography.title)
                    .foregroundStyle(Theme.Colors.textPrimary)
            }
        }
    }

    // MARK: - Stats Row

    private var statsRow: some View {
        HStack(spacing: Theme.Spacing.md) {
            if let duration = day.estimatedDuration, duration > 0 {
                statPill(
                    icon: "clock",
                    text: formatDuration(duration),
                    accessibilityLabel: "\(duration) minutes"
                )
            }

            if let exercises = day.exercises, !exercises.isEmpty {
                statPill(
                    icon: "figure.strengthtraining.traditional",
                    text: "\(exercises.count) exercises",
                    accessibilityLabel: "\(exercises.count) exercises"
                )
            }

            Spacer()
        }
    }

    private func statPill(icon: String, text: String, accessibilityLabel: String) -> some View {
        HStack(spacing: Theme.Spacing.xs) {
            Image(systemName: icon)
                .font(.system(size: 12))
                .accessibilityHidden(true)
            Text(text)
                .font(Theme.Typography.calloutMedium)
        }
        .foregroundStyle(Theme.Colors.textSecondary)
        .padding(.horizontal, Theme.Spacing.md)
        .padding(.vertical, Theme.Spacing.sm)
        .background(Theme.Colors.muted)
        .clipShape(Capsule())
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityLabel)
    }

    private var divider: some View {
        Rectangle()
            .fill(Theme.Colors.border)
            .frame(height: 1)
    }

    // MARK: - Exercise List

    private var exerciseList: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text("Exercises")
                .font(Theme.Typography.headline)
                .foregroundStyle(Theme.Colors.textPrimary)

            if let exercises = day.exercises, !exercises.isEmpty {
                ForEach(Array(exercises.enumerated()), id: \.offset) { index, exercise in
                    exerciseRow(index: index + 1, exercise: exercise)
                }
            } else {
                Text("No exercises listed for this day.")
                    .font(Theme.Typography.callout)
                    .foregroundStyle(Theme.Colors.textTertiary)
                    .padding(.vertical, Theme.Spacing.lg)
            }
        }
    }

    private func exerciseRow(index: Int, exercise: ScheduleExercise) -> some View {
        HStack(spacing: Theme.Spacing.md) {
            // Number circle
            Text("\(index)")
                .font(Theme.Typography.caption)
                .foregroundStyle(Theme.Colors.textTertiary)
                .frame(width: 24, height: 24)
                .background(Theme.Colors.muted)
                .clipShape(Circle())

            // Exercise name
            Text(exercise.name)
                .font(Theme.Typography.callout)
                .foregroundStyle(Theme.Colors.textPrimary)
                .lineLimit(2)

            Spacer()

            // Sets x reps
            Text(exercise.volumeText)
                .font(Theme.Typography.monoText)
                .foregroundStyle(Theme.Colors.textSecondary)
        }
        .padding(.vertical, Theme.Spacing.xs)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(index). \(exercise.name), \(exercise.volumeText)")
    }

    // MARK: - Open in Tonal

    private func openInTonalButton(_ tonalWorkoutId: String) -> some View {
        VStack(spacing: 0) {
            Rectangle()
                .fill(Theme.Colors.border)
                .frame(height: 1)
                .padding(.bottom, Theme.Spacing.lg)

            Button {
                let url = "https://link.tonal.com/custom-workout/\(tonalWorkoutId)"
                TonalDeepLink.openInTonal(url: url)
            } label: {
                HStack(spacing: Theme.Spacing.sm) {
                    Image(systemName: "arrow.up.forward.app")
                        .accessibilityHidden(true)
                    Text("Open in Tonal")
                }
                .frame(maxWidth: .infinity)
                .primaryButtonStyle()
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Open this workout in the Tonal app")
        }
    }

    // MARK: - Helpers

    /// Converts "2026-03-24" to "Monday, March 24".
    private var fullDateString: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        guard let date = formatter.date(from: day.date) else {
            return "\(day.dayName), \(day.date)"
        }
        let display = DateFormatter()
        display.dateFormat = "EEEE, MMMM d"
        return display.string(from: date)
    }

    /// Formats minutes into "30 min" or "1h 15m".
    private func formatDuration(_ minutes: Int) -> String {
        if minutes < 60 { return "\(minutes) min" }
        let h = minutes / 60
        let m = minutes % 60
        return m > 0 ? "\(h)h \(m)m" : "\(h)h"
    }
}
