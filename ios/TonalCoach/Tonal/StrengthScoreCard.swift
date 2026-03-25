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
        .frame(maxWidth: .infinity)
    }

    // MARK: - Overall Ring

    private var overallRing: some View {
        let score = data.distribution.overallScore
        return ScoreRing(score: score, size: 96, lineWidth: 10)
    }

    // MARK: - Region Rings

    private var regionRings: some View {
        HStack(spacing: Theme.Spacing.xl) {
            ForEach(regionScores, id: \.label) { region in
                VStack(spacing: Theme.Spacing.sm) {
                    ScoreRing(score: region.score, size: 64, lineWidth: 6)
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

    @State private var animatedProgress: Double = 0

    init(score: Double, size: CGFloat, lineWidth: CGFloat, maxScore: Double = 500) {
        self.score = score
        self.maxScore = maxScore
        self.size = size
        self.lineWidth = lineWidth
    }

    private var ringColor: Color {
        let pct = score / maxScore
        if pct >= 0.7 { return Theme.Colors.primary }
        if pct >= 0.4 { return Theme.Colors.chart5 }
        return Theme.Colors.chart4
    }

    var body: some View {
        ZStack {
            Circle()
                .stroke(Theme.Colors.border, lineWidth: lineWidth)

            Circle()
                .trim(from: 0, to: animatedProgress)
                .stroke(
                    ringColor,
                    style: StrokeStyle(lineWidth: lineWidth, lineCap: .round)
                )
                .rotationEffect(.degrees(-90))
                .shadow(color: ringColor.opacity(0.3), radius: 10)

            CountingText(target: score, format: "%.0f")
                .font(Theme.Typography.monoText)
                .fontWeight(.bold)
                .foregroundColor(Theme.Colors.foreground)
        }
        .frame(width: size, height: size)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Score \(Int(score)) out of \(Int(maxScore))")
        .onAppear {
            withAnimation(Animate.gentle) {
                animatedProgress = min(score / maxScore, 1.0)
            }
        }
    }
}
