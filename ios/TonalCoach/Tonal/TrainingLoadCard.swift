import SwiftUI

/// Dashboard card showing 7-day training load as proportionally filled day circles.
struct TrainingLoadCard: View {
    let tonalActivities: [TonalActivity]
    let externalActivities: [TonalExternalActivity]

    private static let dayAbbreviations = ["M", "T", "W", "T", "F", "S", "S"]

    var body: some View {
        VStack(spacing: Theme.Spacing.md) {
            dayCircles
            summaryText
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Day Circles

    private var dayCircles: some View {
        HStack(spacing: Theme.Spacing.sm) {
            ForEach(Array(weekDays.enumerated()), id: \.offset) { index, day in
                VStack(spacing: Theme.Spacing.xs) {
                    ZStack {
                        Circle()
                            .stroke(Theme.Colors.border, lineWidth: 2)
                            .frame(width: 32, height: 32)

                        if day.tonalMinutes > 0 {
                            Circle()
                                .trim(from: 0, to: CGFloat(min(day.tonalMinutes / maxMinutes, 1.0)))
                                .stroke(
                                    Theme.Colors.primary,
                                    style: StrokeStyle(lineWidth: 2, lineCap: .round)
                                )
                                .rotationEffect(.degrees(-90))
                                .frame(width: 32, height: 32)
                        }

                        if day.externalMinutes > 0 {
                            Circle()
                                .trim(
                                    from: CGFloat(min(day.tonalMinutes / maxMinutes, 1.0)),
                                    to: CGFloat(min((day.tonalMinutes + day.externalMinutes) / maxMinutes, 1.0))
                                )
                                .stroke(
                                    Theme.Colors.mutedForeground,
                                    style: StrokeStyle(lineWidth: 2, lineCap: .round)
                                )
                                .rotationEffect(.degrees(-90))
                                .frame(width: 32, height: 32)
                        }
                    }
                    .modifier(TodayGlowIfNeeded(isToday: day.isToday))

                    Text(Self.dayAbbreviations[index % 7])
                        .font(Theme.Typography.caption2)
                        .foregroundStyle(
                            day.isToday
                                ? Theme.Colors.primary
                                : Theme.Colors.textTertiary
                        )
                }
            }
        }
    }

    // MARK: - Summary

    private var summaryText: some View {
        let totalSessions = weekDays.filter { $0.tonalMinutes > 0 || $0.externalMinutes > 0 }.count
        let totalMinutes = weekDays.reduce(0.0) { $0 + $1.tonalMinutes + $1.externalMinutes }
        let hours = Int(totalMinutes) / 60
        let mins = Int(totalMinutes) % 60

        return Text("\(totalSessions) sessions | \(hours)h \(mins)m total")
            .font(Theme.Typography.caption)
            .foregroundStyle(Theme.Colors.textSecondary)
    }

    // MARK: - Data Processing

    private struct DayData {
        let date: String
        var tonalMinutes: Double = 0
        var externalMinutes: Double = 0
        var isToday: Bool = false
    }

    private var weekDays: [DayData] {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: Date())

        // Build 7-day window (Monday through Sunday of current week)
        let weekday = calendar.component(.weekday, from: today)
        // Calendar weekday: 1=Sun, 2=Mon...7=Sat. Convert so Monday=0.
        let mondayOffset = (weekday + 5) % 7
        let monday = calendar.date(byAdding: .day, value: -mondayOffset, to: today)!

        var days: [DayData] = (0..<7).map { offset in
            let date = calendar.date(byAdding: .day, value: offset, to: monday)!
            let dateStr = formatDate(date)
            return DayData(
                date: dateStr,
                isToday: calendar.isDate(date, inSameDayAs: today)
            )
        }

        // Aggregate Tonal activities by day
        let isoFormatter = ISO8601DateFormatter()
        isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let isoBasic = ISO8601DateFormatter()

        for activity in tonalActivities {
            guard let date = isoFormatter.date(from: activity.activityTime)
                ?? isoBasic.date(from: activity.activityTime) else { continue }
            let dateStr = formatDate(date)
            if let idx = days.firstIndex(where: { $0.date == dateStr }) {
                days[idx].tonalMinutes += activity.workoutPreview.totalDuration / 60
            }
        }

        // Aggregate external activities by day
        for activity in externalActivities {
            guard let date = isoFormatter.date(from: activity.beginTime)
                ?? isoBasic.date(from: activity.beginTime) else { continue }
            let dateStr = formatDate(date)
            if let idx = days.firstIndex(where: { $0.date == dateStr }) {
                days[idx].externalMinutes += activity.activeDuration / 60
            }
        }

        return days
    }

    private var maxMinutes: Double {
        let dayMax = weekDays.map { $0.tonalMinutes + $0.externalMinutes }.max() ?? 1
        return max(dayMax, 1)
    }

    private func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }
}

// MARK: - Today Glow Conditional Modifier

private struct TodayGlowIfNeeded: ViewModifier {
    let isToday: Bool

    func body(content: Content) -> some View {
        if isToday {
            content.todayGlow()
        } else {
            content
        }
    }
}
