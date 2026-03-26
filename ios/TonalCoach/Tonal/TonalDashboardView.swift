import SwiftUI

/// Combined data from the two training-load API calls.
private struct TrainingLoadData {
    let workouts: [TonalActivity]
    let external: [TonalExternalActivity]
}

/// Unified dashboard displaying readiness, sleep, training load, body/heart,
/// and strength cards. Each section loads independently via `AsyncCard`.
struct TonalDashboardView: View {
    @Environment(ConvexManager.self) private var convex
    @Binding var selectedTab: AppTab
    @State private var refreshID = UUID()

    var body: some View {
        ScrollView {
            VStack(spacing: Theme.Spacing.lg) {
                // 1. Greeting header
                greetingHeader
                    .staggeredAppear(index: 0)

                // 2. Coach Insight
                AsyncCard(title: nil) { [convex] in
                    try await convex.query(
                        "dashboard:getCoachInsight"
                    ) as CoachInsight
                } content: { data in
                    CoachInsightBanner(insight: data.insight) {
                        selectedTab = .chat
                    }
                }
                .staggeredAppear(index: 1)

                // 3. Readiness Ring
                AsyncCard(title: "Readiness") { [convex] in
                    try await convex.query(
                        "dashboard:getReadinessScore"
                    ) as ReadinessScore
                } content: { data in
                    ReadinessCard(readiness: data)
                }
                .staggeredAppear(index: 2)

                // 4. Sleep
                AsyncCard(title: "Sleep") { [convex] in
                    try await convex.query(
                        "health:getRecent",
                        args: ["days": Double(7)]
                    ) as [HealthSnapshot]
                } content: { snapshots in
                    SleepCard(healthSnapshots: snapshots)
                }
                .staggeredAppear(index: 3)

                // 5. Training Load (combines workouts + external activities)
                AsyncCard(title: "Training Load") { [convex] in
                    async let workouts: [TonalActivity] = convex.action(
                        "dashboard:getWorkoutHistory", with: [:]
                    )
                    async let external: [TonalExternalActivity] = convex.action(
                        "dashboard:getExternalActivities", with: [:]
                    )
                    return try await TrainingLoadData(
                        workouts: workouts,
                        external: external
                    )
                } content: { data in
                    TrainingLoadCard(
                        tonalActivities: data.workouts,
                        externalActivities: data.external
                    )
                }
                .staggeredAppear(index: 4)

                // 6. Body & Heart
                AsyncCard(title: nil) { [convex] in
                    try await convex.query(
                        "health:getRecent",
                        args: ["days": Double(7)]
                    ) as [HealthSnapshot]
                } content: { snapshots in
                    BodyHeartCard(healthSnapshots: snapshots)
                }
                .staggeredAppear(index: 5)

                // 7. Strength (compact)
                AsyncCard(title: "Strength") { [convex] in
                    try await convex.action(
                        "dashboard:getStrengthData", with: [:]
                    ) as StrengthData
                } content: { data in
                    StrengthScoreCard(data: data, compact: true)
                }
                .staggeredAppear(index: 6)
            }
            .padding(.horizontal, Theme.Spacing.lg)
            .padding(.vertical, Theme.Spacing.md)
        }
        .id(refreshID)
        .background(Theme.Colors.background)
        .refreshable {
            refreshID = UUID()
        }
    }

    // MARK: - Greeting Header

    private var greetingHeader: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
            Text(greetingText)
                .font(Theme.Typography.title)
                .fontWeight(.bold)
                .kerning(-0.5)
                .foregroundColor(Theme.Colors.foreground)
            Text(dateText)
                .font(Theme.Typography.callout)
                .foregroundColor(Theme.Colors.mutedForeground)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Computed Properties

    private var greetingText: String {
        let hour = Calendar.current.component(.hour, from: Date())
        if hour < 12 { return "Good morning" }
        if hour < 17 { return "Good afternoon" }
        return "Good evening"
    }

    private var dateText: String {
        Date().formatted(.dateTime.weekday(.wide).month(.wide).day())
    }
}
