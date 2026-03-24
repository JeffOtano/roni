import SwiftUI

/// Reusable workout card matching the web WorkoutLibraryCard design.
///
/// Displays session type + goal tags, title, description snippet,
/// and a stats footer with duration, exercise count, sets, and level.
struct WorkoutCardView: View {
    let workout: WorkoutCard

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            tagsRow
            titleSection
            Spacer(minLength: 0)
            statsFooter
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Colors.card)
        .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.lg))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.CornerRadius.lg)
                .stroke(Theme.Colors.border, lineWidth: 1)
        )
    }

    // MARK: - Tags Row

    private var tagsRow: some View {
        HStack(spacing: 6) {
            CardBadge(
                text: WorkoutLabels.sessionTypeLabel(workout.sessionType),
                style: .accent
            )
            CardBadge(
                text: WorkoutLabels.goalLabel(workout.goal),
                style: .muted
            )
            if !workout.equipmentConfig.isEmpty {
                CardBadge(
                    text: WorkoutLabels.equipmentLabel(workout.equipmentConfig),
                    style: .muted
                )
            }
        }
        .padding(.bottom, Theme.Spacing.md)
    }

    // MARK: - Title + Description

    private var titleSection: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(workout.title)
                .font(Theme.Typography.cardTitle)
                .foregroundStyle(Theme.Colors.textPrimary)
                .lineLimit(2)
                .fixedSize(horizontal: false, vertical: true)

            if !workout.description.trimmingCharacters(in: .whitespaces).isEmpty {
                Text(workout.description)
                    .font(Theme.Typography.caption)
                    .foregroundStyle(Theme.Colors.textSecondary)
                    .lineLimit(1)
            }
        }
    }

    // MARK: - Stats Footer

    private var statsFooter: some View {
        HStack(spacing: Theme.Spacing.md) {
            CardStatItem(icon: "clock", text: "\(workout.durationMinutes)m")
            CardStatItem(icon: "dumbbell", text: "\(workout.exerciseCount) ex")

            if workout.totalSets > 0 {
                CardStatItem(icon: "square.stack.3d.up", text: "\(workout.totalSets) sets")
            }

            CardLevelIndicator(level: workout.level)
        }
        .padding(.top, Theme.Spacing.md)
        .overlay(alignment: .top) {
            Rectangle()
                .fill(Theme.Colors.border)
                .frame(height: 1)
        }
    }
}

// MARK: - Card Badge

private struct CardBadge: View {
    let text: String
    let style: BadgeStyle

    enum BadgeStyle {
        case accent
        case muted
    }

    var body: some View {
        Text(text)
            .font(.system(size: 11, weight: .medium))
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(backgroundColor)
            .foregroundStyle(foregroundColor)
            .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.sm))
    }

    private var backgroundColor: Color {
        switch style {
        case .accent: Theme.Colors.primary.opacity(0.15)
        case .muted: Theme.Colors.border
        }
    }

    private var foregroundColor: Color {
        switch style {
        case .accent: Theme.Colors.primary
        case .muted: Theme.Colors.textSecondary
        }
    }
}

// MARK: - Stat Item

private struct CardStatItem: View {
    let icon: String
    let text: String

    var body: some View {
        HStack(spacing: 3) {
            Image(systemName: icon)
                .font(.system(size: 10))
            Text(text)
                .font(Theme.Typography.caption)
        }
        .foregroundStyle(Theme.Colors.textSecondary)
    }
}

// MARK: - Level Indicator

private struct CardLevelIndicator: View {
    let level: String

    var body: some View {
        HStack(spacing: 4) {
            Circle()
                .fill(Theme.Colors.levelColor(level))
                .frame(width: 6, height: 6)
            Text(level.capitalized)
                .font(Theme.Typography.caption)
                .foregroundStyle(Theme.Colors.levelColor(level))
        }
    }
}

// MARK: - Labels

/// Maps raw backend string values to user-facing labels, matching goalConfig.ts.
enum WorkoutLabels {
    static func sessionTypeLabel(_ type: String) -> String {
        let labels: [String: String] = [
            "push": "Push", "pull": "Pull", "legs": "Legs",
            "upper": "Upper Body", "lower": "Lower Body", "full_body": "Full Body",
            "chest": "Chest", "back": "Back", "shoulders": "Shoulders",
            "arms": "Arms", "core": "Core",
            "glutes_hamstrings": "Glutes & Hamstrings",
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

/// Placeholder card shown while data is loading.
struct WorkoutCardSkeleton: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Tag placeholders
            HStack(spacing: 6) {
                skeletonRect(width: 60, height: 20)
                skeletonRect(width: 50, height: 20)
            }
            .padding(.bottom, 12)

            // Title placeholder
            skeletonRect(width: .infinity, height: 16)
                .padding(.bottom, 4)
            skeletonRect(width: 140, height: 12)

            Spacer(minLength: 0)

            // Stats footer placeholder
            HStack(spacing: 12) {
                skeletonRect(width: 40, height: 12)
                skeletonRect(width: 40, height: 12)
                skeletonRect(width: 50, height: 12)
            }
            .padding(.top, 12)
            .overlay(alignment: .top) {
                Rectangle()
                    .fill(Theme.Colors.border)
                    .frame(height: 1)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, minHeight: 140, alignment: .leading)
        .background(Theme.Colors.card)
        .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.lg))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.CornerRadius.lg)
                .stroke(Theme.Colors.border, lineWidth: 1)
        )
        .cardShimmer()
    }

    private func skeletonRect(width: CGFloat, height: CGFloat) -> some View {
        RoundedRectangle(cornerRadius: 4)
            .fill(Theme.Colors.border)
            .frame(
                maxWidth: width == .infinity ? .infinity : width,
                minHeight: height,
                maxHeight: height
            )
    }
}

// MARK: - Shimmer Modifier

private struct CardShimmerModifier: ViewModifier {
    @State private var phase: CGFloat = -1

    func body(content: Content) -> some View {
        content
            .overlay(
                LinearGradient(
                    colors: [
                        .clear,
                        Theme.Colors.textTertiary.opacity(0.08),
                        .clear,
                    ],
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

// MARK: - Card Button Style

/// Press effect for tappable cards: slight scale + brightness change.
struct CardButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1.0)
            .brightness(configuration.isPressed ? -0.03 : 0)
            .animation(.easeInOut(duration: 0.15), value: configuration.isPressed)
            .onChange(of: configuration.isPressed) { _, pressed in
                if pressed { Theme.Haptics.light() }
            }
    }
}
