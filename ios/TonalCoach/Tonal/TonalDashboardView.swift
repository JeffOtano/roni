import SwiftUI

/// Main Tonal dashboard that displays all 5 data cards, each loading independently.
/// Uses `AsyncCard` wrappers so sections appear as they load without blocking each other.
struct TonalDashboardView: View {
    @Environment(ConvexManager.self) private var convex
    @State private var refreshID = UUID()

    var body: some View {
        ScrollView {
            VStack(spacing: Theme.Spacing.lg) {
                AsyncCard(title: "Strength Scores") { [convex] in
                    try await convex.action(
                        "dashboard:getStrengthData", with: [:]
                    ) as StrengthData
                } content: { data in
                    StrengthScoreCard(data: data)
                }

                AsyncCard(title: "Muscle Readiness") { [convex] in
                    try await convex.action(
                        "dashboard:getMuscleReadiness", with: [:]
                    ) as MuscleReadiness
                } content: { data in
                    MuscleReadinessCard(data: data)
                }

                AsyncCard(title: "Recent Workouts") { [convex] in
                    try await convex.action(
                        "dashboard:getWorkoutHistory", with: [:]
                    ) as [TonalActivity]
                } content: { workouts in
                    RecentWorkoutsCard(workouts: workouts)
                }

                AsyncCard(title: "Training Frequency") { [convex] in
                    try await convex.action(
                        "dashboard:getTrainingFrequency", with: [:]
                    ) as [TrainingFrequencyEntry]
                } content: { entries in
                    TrainingFrequencyCard(entries: entries)
                }

                AsyncCard(title: "External Activities") { [convex] in
                    try await convex.action(
                        "dashboard:getExternalActivities", with: [:]
                    ) as [TonalExternalActivity]
                } content: { activities in
                    ExternalActivitiesCard(activities: activities)
                }
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
}
