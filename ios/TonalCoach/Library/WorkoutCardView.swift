import SwiftUI

/// Compact workout card optimized for 2-column mobile grid.
struct WorkoutCardView: View {
    let workout: WorkoutCard

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            // Session type color bar
            HStack(spacing: 4) {
                RoundedRectangle(cornerRadius: 2)
                    .fill(Theme.Colors.sessionTypeColor(workout.sessionType))
                    .frame(width: 3, height: 14)
                Text(WorkoutLabels.sessionTypeLabel(workout.sessionType))
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Theme.Colors.sessionTypeColor(workout.sessionType))
                Spacer()
                Circle()
                    .fill(Theme.Colors.levelColor(workout.level))
                    .frame(width: 6, height: 6)
            }

            // Title
            Text(workout.title)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Theme.Colors.textPrimary)
                .lineLimit(2)
                .fixedSize(horizontal: false, vertical: true)

            Spacer(minLength: 0)

            // Compact stats row
            HStack(spacing: 0) {
                Text("\(workout.durationMinutes)min")
                Text(" · ")
                    .foregroundStyle(Theme.Colors.textTertiary)
                Text("\(workout.exerciseCount) ex")
                if workout.totalSets > 0 {
                    Text(" · ")
                        .foregroundStyle(Theme.Colors.textTertiary)
                    Text("\(workout.totalSets) sets")
                }
            }
            .font(.system(size: 11, weight: .medium))
            .foregroundStyle(Theme.Colors.textSecondary)
            .lineLimit(1)
        }
        .padding(12)
        .frame(maxWidth: .infinity, minHeight: 100, alignment: .leading)
        .background(Theme.Colors.card)
        .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.CornerRadius.lg, style: .continuous)
                .stroke(Theme.Colors.border, lineWidth: 1)
        )
    }
}

// MARK: - Labels

/// Maps raw backend string values to user-facing labels.
enum WorkoutLabels {
    static func sessionTypeLabel(_ type: String) -> String {
        let labels: [String: String] = [
            "push": "Push", "pull": "Pull", "legs": "Legs",
            "upper": "Upper Body", "lower": "Lower Body", "full_body": "Full Body",
            "chest": "Chest", "back": "Back", "shoulders": "Shoulders",
            "arms": "Arms", "core": "Core",
            "glutes_hamstrings": "Glutes & Hams",
            "chest_back": "Chest & Back",
            "mobility": "Mobility", "recovery": "Recovery",
        ]
        return labels[type] ?? type.replacingOccurrences(of: "_", with: " ").capitalized
    }

    static func goalLabel(_ goal: String) -> String {
        let labels: [String: String] = [
            "build_muscle": "Hypertrophy", "fat_loss": "Fat Loss",
            "strength": "Strength", "endurance": "Endurance",
            "athletic": "Athletic", "general_fitness": "General Fitness",
            "power": "Power", "functional": "Functional",
            "mobility_flexibility": "Mobility", "sport_complement": "Sport Complement",
        ]
        return labels[goal] ?? goal.replacingOccurrences(of: "_", with: " ").capitalized
    }

    static func equipmentLabel(_ config: String) -> String {
        let labels: [String: String] = [
            "handles_only": "Handles", "handles_bar": "Handles + Bar",
            "full_accessories": "Full Kit", "bodyweight_only": "Bodyweight",
        ]
        return labels[config] ?? config.replacingOccurrences(of: "_", with: " ").capitalized
    }
}

// MARK: - Skeleton Card

struct WorkoutCardSkeleton: View {
    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            RoundedRectangle(cornerRadius: 3)
                .fill(Theme.Colors.border)
                .frame(width: 50, height: 14)
            RoundedRectangle(cornerRadius: 3)
                .fill(Theme.Colors.border)
                .frame(height: 14)
            RoundedRectangle(cornerRadius: 3)
                .fill(Theme.Colors.border)
                .frame(width: 100, height: 14)
            Spacer(minLength: 0)
            RoundedRectangle(cornerRadius: 3)
                .fill(Theme.Colors.border)
                .frame(width: 80, height: 11)
        }
        .padding(12)
        .frame(maxWidth: .infinity, minHeight: 100, alignment: .leading)
        .background(Theme.Colors.card)
        .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.lg))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.CornerRadius.lg)
                .stroke(Theme.Colors.border, lineWidth: 1)
        )
        .cardShimmer()
    }
}

// MARK: - Shimmer

private struct CardShimmerModifier: ViewModifier {
    @State private var phase: CGFloat = -1

    func body(content: Content) -> some View {
        content
            .overlay(
                LinearGradient(
                    colors: [.clear, Theme.Colors.textTertiary.opacity(0.08), .clear],
                    startPoint: .leading,
                    endPoint: .trailing
                )
                .offset(x: phase * 300)
            )
            .clipped()
            .onAppear {
                withAnimation(.linear(duration: 1.5).repeatForever(autoreverses: false)) {
                    phase = 1
                }
            }
    }
}

extension View {
    func cardShimmer() -> some View {
        modifier(CardShimmerModifier())
    }
}

