import SwiftUI

/// Dashboard card showing overall strength score with a large ring,
/// three smaller region rings (Upper, Lower, Core), and a percentile badge.
struct StrengthScoreCard: View {
    let data: StrengthData

    var body: some View {
        VStack(spacing: Theme.Spacing.xl) {
            overallRing
            regionRings
            percentileBadge
        }
    }

    // MARK: - Overall Ring

    private var overallRing: some View {
        let score = data.distribution.overallScore
        return ScoreRing(score: score, size: 120, lineWidth: 10)
    }

    // MARK: - Region Rings

    private var regionRings: some View {
        HStack(spacing: Theme.Spacing.xl) {
            ForEach(regionScores, id: \.label) { region in
                VStack(spacing: Theme.Spacing.sm) {
                    ScoreRing(score: region.score, size: 60, lineWidth: 6)
                    Text(region.label)
                        .font(Theme.Typography.caption)
                        .foregroundStyle(Theme.Colors.textSecondary)
                }
            }
        }
    }

    private var regionScores: [(label: String, score: Double)] {
        let current = data.scores.filter(\.current)
        let upper = current.first { $0.strengthBodyRegion == "upper_body" }?.score ?? 0
        let lower = current.first { $0.strengthBodyRegion == "lower_body" }?.score ?? 0
        let core = current.first { $0.strengthBodyRegion == "core" }?.score ?? 0
        return [
            (label: "Upper", score: upper),
            (label: "Lower", score: lower),
            (label: "Core", score: core),
        ]
    }

    // MARK: - Percentile Badge

    private var percentileBadge: some View {
        let topPercent = Int(100 - data.distribution.percentile)
        return Text("Top \(topPercent)%")
            .font(Theme.Typography.calloutMedium)
            .foregroundStyle(Theme.Colors.primary)
            .padding(.horizontal, Theme.Spacing.md)
            .padding(.vertical, Theme.Spacing.xs)
            .background(Theme.Colors.primary.opacity(0.15))
            .clipShape(Capsule())
    }
}

// MARK: - Score Ring

/// Circular progress ring with a centered score label.
private struct ScoreRing: View {
    let score: Double
    let size: CGFloat
    let lineWidth: CGFloat

    var body: some View {
        ZStack {
            Circle()
                .stroke(Theme.Colors.border, lineWidth: lineWidth)

            Circle()
                .trim(from: 0, to: CGFloat(min(score / 100, 1.0)))
                .stroke(
                    Theme.Colors.primary,
                    style: StrokeStyle(lineWidth: lineWidth, lineCap: .round)
                )
                .rotationEffect(.degrees(-90))

            Text("\(Int(score))")
                .font(size >= 100 ? Theme.Typography.title : Theme.Typography.calloutMedium)
                .fontWeight(.bold)
                .foregroundStyle(Theme.Colors.textPrimary)
        }
        .frame(width: size, height: size)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Score \(Int(score)) out of 100")
    }
}
