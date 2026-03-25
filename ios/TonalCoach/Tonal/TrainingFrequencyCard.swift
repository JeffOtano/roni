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
                    FrequencyRow(
                        entry: entry,
                        color: chartPalette[index % chartPalette.count],
                        maxCount: entries.map(\.count).max() ?? 1,
                        index: index
                    )
                }
            }
        }
    }

    private var emptyState: some View {
        Text("No training data in the last 30 days")
            .font(Theme.Typography.callout)
            .foregroundStyle(Theme.Colors.textTertiary)
            .frame(maxWidth: .infinity, minHeight: 60)
    }
}

private struct FrequencyRow: View {
    let entry: TrainingFrequencyEntry
    let color: Color
    let maxCount: Int
    let index: Int

    @State private var animatedWidth: CGFloat = 0

    var body: some View {
        HStack(spacing: Theme.Spacing.md) {
            Text(entry.targetArea.displayLabel)
                .font(Theme.Typography.callout)
                .foregroundStyle(Theme.Colors.textPrimary)
                .frame(width: 90, alignment: .leading)

            GeometryReader { geo in
                let targetWidth = max(4, geo.size.width * CGFloat(entry.count) / CGFloat(maxCount))

                ZStack(alignment: .leading) {
                    Capsule()
                        .fill(Theme.Colors.muted.opacity(0.5))
                        .frame(height: 8)

                    Capsule()
                        .fill(color)
                        .frame(width: animatedWidth, height: 8)
                }
                .onAppear {
                    let delay = Animate.staggerDelay(index: index, interval: Animate.barStagger)
                    withAnimation(Animate.gentle.delay(delay)) {
                        animatedWidth = targetWidth
                    }
                }
            }
            .frame(height: 8)

            Text("\(entry.count)")
                .font(Theme.Typography.monoText)
                .monospacedDigit()
                .foregroundStyle(Theme.Colors.textSecondary)
                .frame(width: 24, alignment: .trailing)
        }
    }
}

private extension String {
    var displayLabel: String {
        replacingOccurrences(of: "_", with: " ").capitalized
    }
}
