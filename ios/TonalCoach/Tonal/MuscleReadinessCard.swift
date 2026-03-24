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
            ForEach(data.sorted, id: \.name) { muscle in
                MuscleCell(name: muscle.name, value: muscle.value)
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
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(name), \(Int(value)) percent readiness")
    }

    private var statusColor: Color {
        if value > 80 {
            return Theme.Colors.success
        } else if value > 60 {
            return Theme.Colors.warning
        } else {
            return Theme.Colors.error
        }
    }
}
