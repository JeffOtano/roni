import SwiftUI

/// Dashboard card showing muscle readiness percentages in a 2-column grid.
/// Muscles are sorted by readiness value (highest first) and color-coded
/// green/yellow/red based on recovery status.
struct MuscleReadinessCard: View {
    let data: MuscleReadiness

    private let columns = [
        GridItem(.flexible(), spacing: Theme.Spacing.md),
        GridItem(.flexible(), spacing: Theme.Spacing.md),
    ]

    var body: some View {
        LazyVGrid(columns: columns, spacing: Theme.Spacing.sm) {
            ForEach(Array(data.sorted.enumerated()), id: \.element.name) { index, muscle in
                MuscleCell(name: muscle.name, value: muscle.value)
                    .staggeredAppear(index: index, interval: Animate.cellStagger)
            }
        }
    }
}

// MARK: - Muscle Cell

private struct MuscleCell: View {
    let name: String
    let value: Double

    var body: some View {
        HStack(spacing: Theme.Spacing.sm) {
            Circle()
                .fill(statusColor)
                .frame(width: 8, height: 8)

            Text(name)
                .font(Theme.Typography.callout)
                .foregroundStyle(Theme.Colors.textPrimary)
                .lineLimit(1)

            Spacer()

            Text("\(Int(value))%")
                .font(Theme.Typography.monoText)
                .foregroundStyle(Theme.Colors.textSecondary)
        }
        .padding(Theme.Spacing.sm)
        .background(statusColor.opacity(0.1), in: RoundedRectangle(cornerRadius: Theme.CornerRadius.sm))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(name), \(Int(value)) percent readiness")
    }

    private var statusColor: Color {
        if value > 60 {
            return Color(hex: "#34d399") // Ready - emerald
        } else if value > 30 {
            return Color(hex: "#fbbf24") // Recovering - amber
        } else {
            return Color(hex: "#f87171") // Fatigued - rose
        }
    }
}
