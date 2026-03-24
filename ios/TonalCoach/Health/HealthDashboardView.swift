import Charts
import HealthKit
import SwiftUI

// MARK: - Health Dashboard

/// Dashboard view displaying HealthKit data: activity rings, workouts, heart rate, and weight.
struct HealthDashboardView: View {
    @Environment(\.healthKitManager) private var healthManager

    var body: some View {
        ScrollView {
            if !HealthKitManager.isAvailable {
                unavailableView
            } else if !healthManager.isAuthorized {
                connectPromptView
            } else {
                dashboardContent
            }
        }
        .background(Theme.Colors.background)
        .task {
            guard HealthKitManager.isAvailable, healthManager.isAuthorized else { return }
            await healthManager.fetchAllData()
            healthManager.startObservingActivity()
        }
        .refreshable {
            await healthManager.fetchAllData()
        }
    }

    // MARK: - Dashboard Content

    private var dashboardContent: some View {
        LazyVStack(spacing: Theme.Spacing.lg) {
            activitySection
            weeklyOverviewSection
            recentWorkoutsSection
            heartRateSection
            weightTrendSection
        }
        .padding(.horizontal, Theme.Spacing.lg)
        .padding(.vertical, Theme.Spacing.md)
    }

    // MARK: - Activity Rings Section

    private var activitySection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.md) {
            Text("Today's Activity")
                .font(Theme.Typography.title2)
                .foregroundStyle(Theme.Colors.foreground)

            HStack(spacing: Theme.Spacing.xl) {
                ActivityRingView(
                    value: healthManager.todayActiveEnergy,
                    goal: 500,
                    color: .green,
                    label: "Move",
                    unit: "cal"
                )
                ActivityRingView(
                    value: healthManager.todayExerciseMinutes,
                    goal: 30,
                    color: .cyan,
                    label: "Exercise",
                    unit: "min"
                )
                ActivityRingView(
                    value: healthManager.todayStandHours,
                    goal: 12,
                    color: .red,
                    label: "Stand",
                    unit: "hrs"
                )
            }
            .frame(maxWidth: .infinity)
            .padding(Theme.Spacing.lg)
            .cardStyle()
        }
    }

    // MARK: - Weekly Overview Section

    private var weeklyOverviewSection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.md) {
            Text("This Week")
                .font(Theme.Typography.title2)
                .foregroundStyle(Theme.Colors.foreground)

            if let summary = healthManager.weeklyWorkoutSummary {
                HStack(spacing: Theme.Spacing.md) {
                    WeeklyStatCard(
                        value: "\(summary.workoutCount)",
                        label: "Workouts",
                        icon: "figure.strengthtraining.traditional"
                    )
                    WeeklyStatCard(
                        value: "\(Int(summary.totalMinutes))",
                        label: "Minutes",
                        icon: "clock"
                    )
                    WeeklyStatCard(
                        value: "\(Int(summary.totalCalories))",
                        label: "Calories",
                        icon: "flame"
                    )
                }

                HStack(spacing: Theme.Spacing.md) {
                    WeeklyStatCard(
                        value: "\(summary.strengthSessionCount)",
                        label: "Strength",
                        icon: "dumbbell"
                    )
                    WeeklyStatCard(
                        value: "\(summary.cardioSessionCount)",
                        label: "Cardio",
                        icon: "heart.circle"
                    )
                    Spacer()
                }
            } else if healthManager.isLoading {
                ProgressView()
                    .frame(maxWidth: .infinity, minHeight: 80)
            } else {
                emptyStateText("No workout data for this week.")
            }
        }
    }

    // MARK: - Recent Workouts Section

    private var recentWorkoutsSection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.md) {
            Text("Recent Workouts")
                .font(Theme.Typography.title2)
                .foregroundStyle(Theme.Colors.foreground)

            if healthManager.recentWorkouts.isEmpty {
                emptyStateText("No workouts recorded yet.")
            } else {
                LazyVStack(spacing: Theme.Spacing.sm) {
                    ForEach(healthManager.recentWorkouts) { workout in
                        WorkoutRowView(workout: workout)
                    }
                }
            }
        }
    }

    // MARK: - Heart Rate Section

    private var heartRateSection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.md) {
            Text("Heart Rate")
                .font(Theme.Typography.title2)
                .foregroundStyle(Theme.Colors.foreground)

            HStack {
                Image(systemName: "heart.fill")
                    .font(.title2)
                    .foregroundStyle(.red)

                if let rhr = healthManager.restingHeartRate {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("\(Int(rhr)) BPM")
                            .font(Theme.Typography.title)
                            .foregroundStyle(Theme.Colors.foreground)
                        Text("Resting Heart Rate")
                            .font(Theme.Typography.caption)
                            .foregroundStyle(Theme.Colors.textSecondary)
                    }
                } else {
                    Text("No resting heart rate data")
                        .font(Theme.Typography.callout)
                        .foregroundStyle(Theme.Colors.textSecondary)
                }

                Spacer()
            }
            .padding(Theme.Spacing.lg)
            .cardStyle()
        }
    }

    // MARK: - Weight Trend Section

    private var weightTrendSection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.md) {
            Text("Weight Trend")
                .font(Theme.Typography.title2)
                .foregroundStyle(Theme.Colors.foreground)

            if healthManager.weightTrend.isEmpty {
                emptyStateText("No weight data recorded.")
            } else {
                WeightChartView(entries: healthManager.weightTrend)
                    .frame(height: 200)
                    .padding(Theme.Spacing.lg)
                    .cardStyle()
            }
        }
    }

    // MARK: - Unavailable / Connect Views

    private var unavailableView: some View {
        VStack(spacing: Theme.Spacing.lg) {
            Spacer()
            Image(systemName: "heart.slash")
                .font(.system(size: 48))
                .foregroundStyle(Theme.Colors.textTertiary)
            Text("HealthKit Not Available")
                .font(Theme.Typography.title2)
                .foregroundStyle(Theme.Colors.foreground)
            Text("Health data is not available on this device.")
                .font(Theme.Typography.callout)
                .foregroundStyle(Theme.Colors.textSecondary)
                .multilineTextAlignment(.center)
            Spacer()
        }
        .padding(Theme.Spacing.xl)
    }

    private var connectPromptView: some View {
        VStack(spacing: Theme.Spacing.lg) {
            Spacer()
            Image(systemName: "heart.text.square")
                .font(.system(size: 48))
                .foregroundStyle(Theme.Colors.primary)
            Text("Connect Apple Health")
                .font(Theme.Typography.title2)
                .foregroundStyle(Theme.Colors.foreground)
            Text("View your activity, workouts, and health trends alongside your Tonal training.")
                .font(Theme.Typography.callout)
                .foregroundStyle(Theme.Colors.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, Theme.Spacing.xl)
            Button {
                Task {
                    try? await healthManager.requestAuthorization()
                    await healthManager.fetchAllData()
                }
            } label: {
                Text("Connect")
                    .primaryButtonStyle()
            }
            Spacer()
        }
        .padding(Theme.Spacing.xl)
    }

    // MARK: - Helpers

    private func emptyStateText(_ text: String) -> some View {
        Text(text)
            .font(Theme.Typography.callout)
            .foregroundStyle(Theme.Colors.textSecondary)
            .frame(maxWidth: .infinity, minHeight: 60)
            .cardStyle()
    }
}

// MARK: - Activity Ring View

/// A single circular progress ring mimicking Apple's activity rings.
private struct ActivityRingView: View {
    let value: Double
    let goal: Double
    let color: Color
    let label: String
    let unit: String

    private var progress: Double {
        guard goal > 0 else { return 0 }
        return min(value / goal, 1.0)
    }

    var body: some View {
        VStack(spacing: Theme.Spacing.sm) {
            ZStack {
                Circle()
                    .stroke(color.opacity(0.2), lineWidth: 8)
                Circle()
                    .trim(from: 0, to: progress)
                    .stroke(
                        color,
                        style: StrokeStyle(lineWidth: 8, lineCap: .round)
                    )
                    .rotationEffect(.degrees(-90))
                    .animation(.easeInOut(duration: 0.6), value: progress)

                VStack(spacing: 0) {
                    Text("\(Int(value))")
                        .font(Theme.Typography.headline)
                        .foregroundStyle(Theme.Colors.foreground)
                    Text(unit)
                        .font(Theme.Typography.caption2)
                        .foregroundStyle(Theme.Colors.textTertiary)
                }
            }
            .frame(width: 72, height: 72)

            Text(label)
                .font(Theme.Typography.caption)
                .foregroundStyle(color)
        }
    }
}

// MARK: - Weekly Stat Card

/// A compact card showing a single weekly stat value.
private struct WeeklyStatCard: View {
    let value: String
    let label: String
    let icon: String

    var body: some View {
        VStack(spacing: Theme.Spacing.sm) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundStyle(Theme.Colors.primary)
            Text(value)
                .font(Theme.Typography.title2)
                .foregroundStyle(Theme.Colors.foreground)
            Text(label)
                .font(Theme.Typography.caption)
                .foregroundStyle(Theme.Colors.textSecondary)
        }
        .frame(maxWidth: .infinity, minHeight: 80)
        .padding(Theme.Spacing.md)
        .cardStyle()
    }
}

// MARK: - Workout Row View

/// A single row displaying a workout from HealthKit.
private struct WorkoutRowView: View {
    let workout: HealthWorkout

    var body: some View {
        HStack(spacing: Theme.Spacing.md) {
            workoutIcon
                .frame(width: 40, height: 40)
                .background(iconBackgroundColor.opacity(0.15))
                .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.md, style: .continuous))

            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: Theme.Spacing.sm) {
                    Text(workout.activityName)
                        .font(Theme.Typography.headline)
                        .foregroundStyle(Theme.Colors.foreground)
                    if workout.isTonalWorkout {
                        Text("Tonal")
                            .font(Theme.Typography.caption)
                            .foregroundStyle(Theme.Colors.primary)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Theme.Colors.primary.opacity(0.15))
                            .clipShape(
                                RoundedRectangle(
                                    cornerRadius: Theme.CornerRadius.sm,
                                    style: .continuous
                                )
                            )
                    }
                }
                HStack(spacing: Theme.Spacing.md) {
                    Text(formatDuration(workout.duration))
                        .font(Theme.Typography.caption)
                        .foregroundStyle(Theme.Colors.textSecondary)
                    if let cal = workout.totalEnergyBurned {
                        Text("\(Int(cal)) cal")
                            .font(Theme.Typography.caption)
                            .foregroundStyle(Theme.Colors.textSecondary)
                    }
                    if let hr = workout.averageHeartRate {
                        Label("\(Int(hr)) bpm", systemImage: "heart.fill")
                            .font(Theme.Typography.caption)
                            .foregroundStyle(Theme.Colors.textSecondary)
                    }
                }
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 2) {
                Text(workout.startDate.formatted(.dateTime.weekday(.abbreviated)))
                    .font(Theme.Typography.caption)
                    .foregroundStyle(Theme.Colors.textSecondary)
                Text(workout.startDate.formatted(.dateTime.month(.abbreviated).day()))
                    .font(Theme.Typography.caption)
                    .foregroundStyle(Theme.Colors.textTertiary)
            }
        }
        .padding(Theme.Spacing.md)
        .cardStyle()
    }

    private var workoutIcon: some View {
        Image(systemName: iconName)
            .font(.body)
            .foregroundStyle(iconBackgroundColor)
    }

    private var iconName: String {
        if workout.isTonalWorkout || workout.isStrengthTraining {
            return "dumbbell.fill"
        }
        switch workout.activityType {
        case .running: return "figure.run"
        case .cycling: return "figure.outdoor.cycle"
        case .yoga: return "figure.yoga"
        case .highIntensityIntervalTraining: return "bolt.heart.fill"
        case .rowing: return "figure.rower"
        case .swimming: return "figure.pool.swim"
        case .walking: return "figure.walk"
        default: return "figure.mixed.cardio"
        }
    }

    private var iconBackgroundColor: Color {
        if workout.isTonalWorkout {
            return Theme.Colors.primary
        }
        if workout.isStrengthTraining {
            return .orange
        }
        return .cyan
    }

    private func formatDuration(_ interval: TimeInterval) -> String {
        let minutes = Int(interval) / 60
        if minutes >= 60 {
            let hours = minutes / 60
            let remaining = minutes % 60
            return "\(hours)h \(remaining)m"
        }
        return "\(minutes) min"
    }
}

// MARK: - Weight Chart View

/// A line chart showing weight trend over time using Swift Charts.
private struct WeightChartView: View {
    let entries: [WeightEntry]

    private var minWeight: Double {
        (entries.map(\.weightLbs).min() ?? 0) - 2
    }

    private var maxWeight: Double {
        (entries.map(\.weightLbs).max() ?? 200) + 2
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            if let latest = entries.last {
                HStack(alignment: .firstTextBaseline, spacing: Theme.Spacing.xs) {
                    Text(String(format: "%.1f", latest.weightLbs))
                        .font(Theme.Typography.title)
                        .foregroundStyle(Theme.Colors.foreground)
                    Text("lbs")
                        .font(Theme.Typography.caption)
                        .foregroundStyle(Theme.Colors.textSecondary)

                    if entries.count >= 2 {
                        let first = entries.first!.weightLbs
                        let diff = latest.weightLbs - first
                        let arrow = diff >= 0 ? "arrow.up.right" : "arrow.down.right"
                        let color: Color = diff >= 0 ? .red : .green
                        Label(
                            String(format: "%+.1f", diff),
                            systemImage: arrow
                        )
                        .font(Theme.Typography.caption)
                        .foregroundStyle(color)
                    }
                }
            }

            Chart(entries) { entry in
                LineMark(
                    x: .value("Date", entry.date),
                    y: .value("Weight", entry.weightLbs)
                )
                .foregroundStyle(Theme.Colors.primary)
                .interpolationMethod(.catmullRom)

                AreaMark(
                    x: .value("Date", entry.date),
                    y: .value("Weight", entry.weightLbs)
                )
                .foregroundStyle(
                    LinearGradient(
                        colors: [
                            Theme.Colors.primary.opacity(0.3),
                            Theme.Colors.primary.opacity(0.0),
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .interpolationMethod(.catmullRom)
            }
            .chartYScale(domain: minWeight ... maxWeight)
            .chartXAxis {
                AxisMarks(values: .stride(by: .day, count: 7)) { _ in
                    AxisValueLabel(format: .dateTime.month(.abbreviated).day())
                        .foregroundStyle(Theme.Colors.textTertiary)
                    AxisGridLine()
                        .foregroundStyle(Theme.Colors.border)
                }
            }
            .chartYAxis {
                AxisMarks(position: .leading) { _ in
                    AxisValueLabel()
                        .foregroundStyle(Theme.Colors.textTertiary)
                    AxisGridLine()
                        .foregroundStyle(Theme.Colors.border)
                }
            }
        }
    }
}
