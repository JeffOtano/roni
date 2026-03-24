import Charts
import SwiftUI

/// Dashboard card showing workout frequency per target area (last 30 days).
/// Uses Swift Charts for 4+ entries, simple rows for fewer.
struct TrainingFrequencyCard: View {
    let entries: [TrainingFrequencyEntry]

    private let chartPalette: [Color] = [
        Theme.Colors.chart1,
        Theme.Colors.chart2,
        Theme.Colors.chart3,
        Theme.Colors.chart4,
        Theme.Colors.chart5,
    ]

    var body: some View {
        if entries.isEmpty {
            emptyState
        } else {
            VStack(alignment: .leading, spacing: Theme.Spacing.md) {
                ForEach(Array(entries.enumerated()), id: \.element.id) { index, entry in
                    frequencyRow(entry: entry, index: index)
                }
            }
        }
    }

    private func frequencyRow(entry: TrainingFrequencyEntry, index: Int) -> some View {
        let color = chartPalette[index % chartPalette.count]
        let maxCount = entries.map(\.count).max() ?? 1

        return HStack(spacing: Theme.Spacing.md) {
            Text(entry.targetArea.displayLabel)
                .font(Theme.Typography.callout)
                .foregroundStyle(Theme.Colors.textPrimary)
                .frame(width: 90, alignment: .leading)

            GeometryReader { geo in
                RoundedRectangle(cornerRadius: 4)
                    .fill(color)
                    .frame(width: max(4, geo.size.width * CGFloat(entry.count) / CGFloat(maxCount)))
            }
            .frame(height: 20)

            Text("\(entry.count)")
                .font(Theme.Typography.monoText)
                .foregroundStyle(Theme.Colors.textSecondary)
                .frame(width: 24, alignment: .trailing)
        }
    }

    private var emptyState: some View {
        Text("No training data in the last 30 days")
            .font(Theme.Typography.callout)
            .foregroundStyle(Theme.Colors.textTertiary)
            .frame(maxWidth: .infinity, minHeight: 60)
    }
}

private extension String {
    var displayLabel: String {
        replacingOccurrences(of: "_", with: " ").capitalized
    }
}
