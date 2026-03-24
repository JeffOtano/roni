import Charts
import SwiftUI

/// Dashboard card showing a horizontal bar chart of workouts per target area.
/// Uses Swift Charts for native rendering with theme-aware colors.
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
            chart
        }
    }

    private var chart: some View {
        Chart(entries) { entry in
            BarMark(
                x: .value("Workouts", entry.count),
                y: .value("Area", entry.targetArea.displayLabel)
            )
            .foregroundStyle(barColor(for: entry))
            .cornerRadius(4)
        }
        .chartXAxis {
            AxisMarks { value in
                AxisGridLine(stroke: StrokeStyle(lineWidth: 0.5))
                    .foregroundStyle(Theme.Colors.border)
                AxisValueLabel()
                    .foregroundStyle(Theme.Colors.textSecondary)
                    .font(Theme.Typography.caption)
            }
        }
        .chartYAxis {
            AxisMarks { _ in
                AxisValueLabel()
                    .foregroundStyle(Theme.Colors.textSecondary)
                    .font(Theme.Typography.caption)
            }
        }
        .frame(height: CGFloat(max(120, entries.count * 32)))
    }

    private func barColor(for entry: TrainingFrequencyEntry) -> Color {
        guard let index = entries.firstIndex(where: { $0.id == entry.id }) else {
            return chartPalette[0]
        }
        return chartPalette[index % chartPalette.count]
    }

    private var emptyState: some View {
        Text("No training data yet")
            .font(Theme.Typography.callout)
            .foregroundStyle(Theme.Colors.textTertiary)
            .frame(maxWidth: .infinity, minHeight: 60)
    }
}

// MARK: - Display Label Helper

private extension String {
    /// Converts a snake_case target area key into a human-readable label.
    var displayLabel: String {
        replacingOccurrences(of: "_", with: " ").capitalized
    }
}
