import SwiftUI

/// Dashboard card showing weight/HRV sparklines with deltas, and RHR trend.
/// Does not render if both weight and HRV data are nil.
struct BodyHeartCard: View {
    let healthSnapshots: [HealthSnapshot]

    private var last7: [HealthSnapshot] {
        Array(healthSnapshots.prefix(7).reversed())
    }

    private var latestWeight: Double? { healthSnapshots.first?.bodyMass }
    private var latestHRV: Double? { healthSnapshots.first?.hrvSDNN }
    private var latestRHR: Double? { healthSnapshots.first?.restingHeartRate }
    private var hasWeight: Bool { latestWeight != nil }
    private var hasHRV: Bool { latestHRV != nil }

    var body: some View {
        if !hasWeight && !hasHRV {
            EmptyView()
        } else {
            VStack(alignment: .leading, spacing: Theme.Spacing.md) {
                columnsRow
                rhrRow
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    // MARK: - Columns

    private var columnsRow: some View {
        HStack(alignment: .top, spacing: Theme.Spacing.lg) {
            if hasWeight {
                weightColumn
            }
            if hasHRV {
                hrvColumn
            }
        }
    }

    private var weightColumn: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
            Text("Weight")
                .font(Theme.Typography.caption)
                .foregroundStyle(Theme.Colors.textTertiary)

            Text(String(format: "%.1f", latestWeight ?? 0))
                .font(Theme.Typography.title2)
                .fontWeight(.bold)
                .foregroundStyle(Theme.Colors.foreground)

            SparklineView(
                values: last7.map(\.bodyMass),
                color: Theme.Colors.chart2,
                height: 24
            )

            weightDelta
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var hrvColumn: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
            Text("HRV")
                .font(Theme.Typography.caption)
                .foregroundStyle(Theme.Colors.textTertiary)

            Text(String(format: "%.0f", latestHRV ?? 0))
                .font(Theme.Typography.title2)
                .fontWeight(.bold)
                .foregroundStyle(Theme.Colors.foreground)

            SparklineView(
                values: last7.map(\.hrvSDNN),
                color: Theme.Colors.chart3,
                height: 24
            )

            hrvDelta
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Deltas

    private var weightDelta: some View {
        Group {
            let weights = last7.compactMap(\.bodyMass)
            if weights.count >= 2, let first = weights.first, let last = weights.last {
                let diff = last - first
                let sign = diff >= 0 ? "+" : ""
                Text("\(sign)\(String(format: "%.1f", diff)) kg")
                    .font(Theme.Typography.caption)
                    .foregroundStyle(Theme.Colors.textSecondary)
            }
        }
    }

    private var hrvDelta: some View {
        Group {
            let hrvValues = last7.compactMap(\.hrvSDNN)
            if hrvValues.count >= 2, let first = hrvValues.first, let last = hrvValues.last {
                let diff = last - first
                let sign = diff >= 0 ? "+" : ""
                Text("\(sign)\(String(format: "%.0f", diff)) ms")
                    .font(Theme.Typography.caption)
                    .foregroundStyle(Theme.Colors.textSecondary)
            }
        }
    }

    // MARK: - RHR Row

    private var rhrRow: some View {
        Group {
            if let rhr = latestRHR {
                HStack(spacing: Theme.Spacing.sm) {
                    Text("RHR")
                        .font(Theme.Typography.caption)
                        .foregroundStyle(Theme.Colors.textTertiary)

                    Text("\(Int(rhr)) bpm")
                        .font(Theme.Typography.calloutMedium)
                        .foregroundStyle(Theme.Colors.foreground)

                    Image(systemName: rhrTrendIcon)
                        .font(.system(size: 10))
                        .foregroundStyle(Theme.Colors.textSecondary)

                    if let avg = rhrAverage {
                        Text("vs \(Int(avg)) avg")
                            .font(Theme.Typography.caption)
                            .foregroundStyle(Theme.Colors.textTertiary)
                    }
                }
            }
        }
    }

    private var rhrAverage: Double? {
        let values = last7.compactMap(\.restingHeartRate)
        guard values.count >= 2 else { return nil }
        return values.reduce(0, +) / Double(values.count)
    }

    private var rhrTrendIcon: String {
        let values = last7.compactMap(\.restingHeartRate)
        guard values.count >= 2, let first = values.first, let last = values.last else {
            return "arrow.right"
        }
        let diff = last - first
        if diff > 2 { return "arrow.up.right" }
        if diff < -2 { return "arrow.down.right" }
        return "arrow.right"
    }
}
