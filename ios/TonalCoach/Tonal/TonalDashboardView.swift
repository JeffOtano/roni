import SwiftUI

/// Main Tonal dashboard that displays all 5 data cards, each loading independently.
/// Uses `AsyncCard` wrappers so sections appear as they load without blocking each other.
struct TonalDashboardView: View {
    @Environment(ConvexManager.self) private var convex
    @Binding var selectedTab: AppTab
    @State private var refreshID = UUID()

    var body: some View {
        ScrollView {
            VStack(spacing: Theme.Spacing.lg) {
                // Greeting header
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
                .staggeredAppear(index: 0)

                // Coach CTA banner
                Button {
                    selectedTab = .chat
                } label: {
                    HStack(spacing: Theme.Spacing.sm) {
                        Image(systemName: "sparkles")
                            .font(.system(size: 16, weight: .semibold))
                        Text("Ask your coach about today's plan")
                            .font(Theme.Typography.callout)
                    }
                    .foregroundColor(Theme.Colors.primary.opacity(0.8))
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(Theme.Spacing.lg)
                    .background(Theme.Colors.primary.opacity(0.1))
                    .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.lg))
                }
                .pressableCard()
                .staggeredAppear(index: 1)

                AsyncCard(title: "Strength Scores") { [convex] in
                    try await convex.action(
                        "dashboard:getStrengthData", with: [:]
                    ) as StrengthData
                } content: { data in
                    StrengthScoreCard(data: data)
                }
                .staggeredAppear(index: 2)

                AsyncCard(title: "Muscle Readiness") { [convex] in
                    try await convex.action(
                        "dashboard:getMuscleReadiness", with: [:]
                    ) as MuscleReadiness
                } content: { data in
                    MuscleReadinessCard(data: data)
                }
                .staggeredAppear(index: 3)

                AsyncCard(title: "Recent Workouts") { [convex] in
                    try await convex.action(
                        "dashboard:getWorkoutHistory", with: [:]
                    ) as [TonalActivity]
                } content: { workouts in
                    RecentWorkoutsCard(workouts: workouts)
                }
                .staggeredAppear(index: 4)

                AsyncCard(title: "Training Frequency") { [convex] in
                    try await convex.action(
                        "dashboard:getTrainingFrequency", with: [:]
                    ) as [TrainingFrequencyEntry]
                } content: { entries in
                    TrainingFrequencyCard(entries: entries)
                }
                .staggeredAppear(index: 5)

                AsyncCard(title: "External Activities") { [convex] in
                    try await convex.action(
                        "dashboard:getExternalActivities", with: [:]
                    ) as [TonalExternalActivity]
                } content: { activities in
                    ExternalActivitiesCard(activities: activities)
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
