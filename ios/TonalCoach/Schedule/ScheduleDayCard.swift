import SwiftUI

// MARK: - Schedule Day Card

/// Renders a single day in the weekly schedule.
///
/// Two visual modes:
/// - **Training day**: full card with left color bar, badges, exercise preview
/// - **Rest day**: minimal muted row with moon icon
struct ScheduleDayCard: View {
    let day: ScheduleDay

    var body: some View {
        if day.isTraining {
            trainingCard
        } else {
            restRow
        }
    }

    // MARK: - Training Card

    private var trainingCard: some View {
        HStack(spacing: 0) {
            // Left color bar
            RoundedRectangle(cornerRadius: 2)
                .fill(Theme.Colors.sessionTypeColor(day.sessionType))
                .frame(width: 3)

            VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
                // Day name + date
                HStack {
                    Text(day.dayName)
                        .font(Theme.Typography.headline)
                        .foregroundStyle(Theme.Colors.textPrimary)
                    Spacer()
                    Text(formatDate(day.date))
                        .font(Theme.Typography.caption)
                        .foregroundStyle(Theme.Colors.textSecondary)
                }

                // Session type badge + status badge
                HStack(spacing: Theme.Spacing.sm) {
                    Text(WorkoutLabels.sessionTypeLabel(day.sessionType))
                        .sessionBadgeStyle(for: day.sessionType)
                    StatusBadgeView(status: day.derivedStatus)
                    Spacer()
                }

                // Workout title
                if let title = day.workoutTitle {
                    Text(title)
                        .font(Theme.Typography.calloutMedium)
                        .foregroundStyle(Theme.Colors.textPrimary)
                        .lineLimit(2)
                }

                // Exercise preview + duration
                HStack {
                    if let exercises = day.exercises, !exercises.isEmpty {
                        exercisePreview(exercises)
                    }
                    Spacer()
                    if let duration = day.estimatedDuration, duration > 0 {
                        durationPill(duration)
                    }
                }
            }
            .padding(Theme.Spacing.md)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .cardStyle()
        .accessibilityElement(children: .combine)
        .accessibilityLabel(trainingAccessibilityLabel)
    }

    // MARK: - Rest Row

    private var restRow: some View {
        HStack(spacing: Theme.Spacing.sm) {
            Image(systemName: "moon.fill")
                .font(.system(size: 12))
                .foregroundStyle(Theme.Colors.textTertiary)
                .accessibilityHidden(true)

            Text(day.dayName)
                .font(Theme.Typography.callout)
                .foregroundStyle(Theme.Colors.textTertiary)

            Text(formatDate(day.date))
                .font(Theme.Typography.caption)
                .foregroundStyle(Theme.Colors.textTertiary.opacity(0.6))

            Spacer()

            Text("Rest Day")
                .font(Theme.Typography.caption)
                .foregroundStyle(Theme.Colors.textTertiary)
                .italic()
        }
        .padding(.horizontal, Theme.Spacing.lg)
        .padding(.vertical, Theme.Spacing.md)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(day.dayName), \(formatDate(day.date)), Rest day")
    }

    // MARK: - Exercise Preview

    /// Shows first 3 exercise names with "+N more" if truncated.
    private func exercisePreview(_ exercises: [ScheduleExercise]) -> some View {
        let names = exercises.prefix(3).map(\.name)
        let remaining = exercises.count - names.count

        return HStack(spacing: 0) {
            Text(names.joined(separator: ", "))
                .lineLimit(1)
            if remaining > 0 {
                Text(" +\(remaining) more")
                    .foregroundStyle(Theme.Colors.textTertiary)
            }
        }
        .font(Theme.Typography.caption)
        .foregroundStyle(Theme.Colors.textSecondary)
    }

    // MARK: - Duration Pill

    private func durationPill(_ minutes: Int) -> some View {
        HStack(spacing: 3) {
            Image(systemName: "clock")
                .font(.system(size: 10))
                .accessibilityHidden(true)
            Text(formatDuration(minutes))
        }
        .font(Theme.Typography.caption)
        .foregroundStyle(Theme.Colors.textSecondary)
        .padding(.horizontal, Theme.Spacing.sm)
        .padding(.vertical, 3)
        .background(Theme.Colors.muted)
        .clipShape(Capsule())
        .accessibilityLabel("\(minutes) minutes")
    }

    // MARK: - Accessibility

    private var trainingAccessibilityLabel: String {
        var parts = [day.dayName, formatDate(day.date)]
        parts.append(WorkoutLabels.sessionTypeLabel(day.sessionType))
        parts.append(StatusBadgeView.statusLabel(day.derivedStatus))
        if let title = day.workoutTitle {
            parts.append(title)
        }
        if let duration = day.estimatedDuration, duration > 0 {
            parts.append("\(duration) minutes")
        }
        return parts.joined(separator: ", ")
    }

    // MARK: - Helpers

    /// Converts "2026-03-24" to "Mar 24".
    private func formatDate(_ isoDate: String) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        guard let date = formatter.date(from: isoDate) else { return isoDate }
        let display = DateFormatter()
        display.dateFormat = "MMM d"
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

// MARK: - Status Badge View

/// Inline badge showing workout status with icon and colored text.
///
/// Uses icon + text + color (never color alone) for accessibility.
struct StatusBadgeView: View {
    let status: String

    var body: some View {
        HStack(spacing: 3) {
            Image(systemName: iconName)
                .font(.system(size: 10))
                .accessibilityHidden(true)
            Text(StatusBadgeView.statusLabel(status))
        }
        .font(Theme.Typography.caption)
        .foregroundStyle(statusColor)
        .padding(.horizontal, Theme.Spacing.sm)
        .padding(.vertical, 2)
        .background(statusColor.opacity(0.12))
        .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.sm, style: .continuous))
    }

    /// Human-readable label for a status value.
    static func statusLabel(_ status: String) -> String {
        switch status {
        case "completed":  return "Completed"
        case "programmed": return "Scheduled"
        case "missed":     return "Missed"
        case "failed":     return "Failed"
        case "rest":       return "Rest Day"
        default:           return status.capitalized
        }
    }

    private var iconName: String {
        switch status {
        case "completed":  return "checkmark.circle.fill"
        case "programmed": return "clock.fill"
        case "missed":     return "exclamationmark.triangle.fill"
        case "failed":     return "xmark.circle.fill"
        default:           return "circle"
        }
    }

    private var statusColor: Color {
        switch status {
        case "completed":  return Theme.Colors.success
        case "programmed": return Theme.Colors.primary
        case "missed":     return Theme.Colors.warning
        case "failed":     return Theme.Colors.error
        default:           return Theme.Colors.textTertiary
        }
    }
}
