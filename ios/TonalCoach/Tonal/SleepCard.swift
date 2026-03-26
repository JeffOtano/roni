import SwiftUI

/// Dashboard card showing sleep duration, quality, stage breakdown, and 7-day history.
struct SleepCard: View {
    let healthSnapshots: [HealthSnapshot]

    private var latest: HealthSnapshot? { healthSnapshots.first }

    private var hasSleepData: Bool {
        latest?.sleepDurationMinutes != nil
    }

    var body: some View {
        if hasSleepData {
            sleepContent
        } else {
            noSleepView
        }
    }

    // MARK: - Sleep Content

    private var sleepContent: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.md) {
            durationHeader
            qualityPill
            stageBar
            bedWakeTimes
            weeklyMiniChart
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Duration Header

    private var durationHeader: some View {
        let totalMinutes = latest?.sleepDurationMinutes ?? 0
        let hours = Int(totalMinutes) / 60
        let mins = Int(totalMinutes) % 60
        return Text("\(hours)h \(mins)m")
            .font(Theme.Typography.title2)
            .fontWeight(.bold)
            .foregroundStyle(Theme.Colors.foreground)
    }

    // MARK: - Quality Pill

    private var qualityPill: some View {
        let quality = sleepQuality
        return Text(quality.label)
            .font(Theme.Typography.caption)
            .foregroundStyle(quality.color)
            .padding(.horizontal, Theme.Spacing.sm)
            .padding(.vertical, 2)
            .background(quality.color.opacity(0.15))
            .clipShape(Capsule())
    }

    // MARK: - Stage Bar

    private var stageBar: some View {
        GeometryReader { geometry in
            let width = geometry.size.width
            let totalMinutes = latest?.sleepDurationMinutes ?? 1
            let deep = latest?.sleepDeepMinutes ?? 0
            let rem = latest?.sleepRemMinutes ?? 0
            let core = latest?.sleepCoreMinutes ?? 0
            let awake = latest?.sleepAwakeMinutes ?? 0
            let stageTotal = deep + rem + core + awake
            let safeDivisor = stageTotal > 0 ? stageTotal : totalMinutes

            HStack(spacing: 1) {
                stageSegment(
                    width: width * CGFloat(deep / safeDivisor),
                    color: Color(hex: "7c3aed")
                )
                stageSegment(
                    width: width * CGFloat(rem / safeDivisor),
                    color: Color(hex: "3b82f6")
                )
                stageSegment(
                    width: width * CGFloat(core / safeDivisor),
                    color: Theme.Colors.primary
                )
                stageSegment(
                    width: width * CGFloat(awake / safeDivisor),
                    color: Theme.Colors.muted
                )
            }
            .clipShape(Capsule())
        }
        .frame(height: 8)
    }

    private func stageSegment(width: CGFloat, color: Color) -> some View {
        Rectangle()
            .fill(color)
            .frame(width: max(width, 0))
    }

    // MARK: - Bed/Wake Times

    private var bedWakeTimes: some View {
        Group {
            if let start = latest?.sleepStartTime, let end = latest?.sleepEndTime {
                Text("\(formatTime(start)) - \(formatTime(end))")
                    .font(Theme.Typography.caption)
                    .foregroundStyle(Theme.Colors.textTertiary)
            }
        }
    }

    // MARK: - Weekly Mini Chart

    private var weeklyMiniChart: some View {
        let last7 = Array(healthSnapshots.prefix(7).reversed())
        let maxDuration = last7.compactMap(\.sleepDurationMinutes).max() ?? 480

        return HStack(alignment: .bottom, spacing: Theme.Spacing.xs) {
            ForEach(Array(last7.enumerated()), id: \.offset) { index, snapshot in
                let duration = snapshot.sleepDurationMinutes ?? 0
                let height = maxDuration > 0 ? CGFloat(duration / maxDuration) * 24 : 0
                let isToday = index == last7.count - 1

                RoundedRectangle(cornerRadius: 2)
                    .fill(isToday ? Theme.Colors.primary : Theme.Colors.muted)
                    .frame(width: 8, height: max(height, 2))
            }
        }
        .frame(height: 24)
    }

    // MARK: - No Sleep View

    private var noSleepView: some View {
        HStack(spacing: Theme.Spacing.sm) {
            Image(systemName: "applewatch")
                .font(.system(size: 16))
                .foregroundStyle(Theme.Colors.textTertiary)
            Text("Connect Apple Watch for sleep tracking")
                .font(Theme.Typography.callout)
                .foregroundStyle(Theme.Colors.textSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Helpers

    private var sleepQuality: (label: String, color: Color) {
        let minutes = latest?.sleepDurationMinutes ?? 0
        if minutes >= 420 { return ("Excellent", Theme.Colors.success) }
        if minutes >= 360 { return ("Good", Theme.Colors.primary) }
        if minutes >= 300 { return ("Fair", Theme.Colors.chart5) }
        return ("Poor", Theme.Colors.chart4)
    }

    private func formatTime(_ isoTime: String) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = formatter.date(from: isoTime) ?? ISO8601DateFormatter().date(from: isoTime)
        guard let date else { return isoTime }
        let display = DateFormatter()
        display.dateFormat = "h:mm a"
        return display.string(from: date)
    }
}
