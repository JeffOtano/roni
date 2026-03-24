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

    /// Fuzzy-match a region score by checking strengthBodyRegion and bodyRegionDisplay.
    /// Matches the web's `findScore` logic: key === r || key.startsWith(r) || key.includes(r)
    private func findScore(_ region: String) -> Double {
        let r = region.lowercased()
        let match = data.scores.first { s in
            let key = (s.strengthBodyRegion.isEmpty ? s.bodyRegionDisplay : s.strengthBodyRegion).lowercased()
            return key == r || key.hasPrefix(r) || key.contains(r)
        }
        return match?.score ?? 0
    }

    private var regionScores: [(label: String, score: Double)] {
        [
            (label: "Upper", score: findScore("upper")),
            (label: "Lower", score: findScore("lower")),
            (label: "Core", score: findScore("core")),
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
    let maxScore: Double
    let size: CGFloat
    let lineWidth: CGFloat

    init(score: Double, size: CGFloat, lineWidth: CGFloat, maxScore: Double = 500) {
        self.score = score
        self.maxScore = maxScore
        self.size = size
        self.lineWidth = lineWidth
    }

    var body: some View {
        let progress = min(score / maxScore, 1.0)
        ZStack {
            Circle()
                .stroke(Theme.Colors.border, lineWidth: lineWidth)

            Circle()
                .trim(from: 0, to: CGFloat(progress))
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
        .accessibilityLabel("Score \(Int(score)) out of \(Int(maxScore))")
    }
}
