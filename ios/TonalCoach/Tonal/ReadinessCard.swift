import SwiftUI

/// Hero card displaying the readiness score ring, label, and 4 factor pills.
struct ReadinessCard: View {
    let readiness: ReadinessScore

    @State private var animatedProgress: Double = 0

    var body: some View {
        VStack(spacing: Theme.Spacing.lg) {
            scoreRing
            scoreLabel
            factorPills
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Score Ring

    private var scoreRing: some View {
        ZStack {
            Circle()
                .stroke(Theme.Colors.border, lineWidth: 10)

            Circle()
                .trim(from: 0, to: animatedProgress)
                .stroke(
                    ringColor,
                    style: StrokeStyle(lineWidth: 10, lineCap: .round)
                )
                .rotationEffect(.degrees(-90))
                .shadow(color: ringColor.opacity(0.3), radius: 10)

            CountingText(target: readiness.score, format: "%.0f")
                .font(Theme.Typography.largeTitle)
                .fontWeight(.bold)
                .foregroundStyle(Theme.Colors.foreground)
        }
        .frame(width: 96, height: 96)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Readiness score \(Int(readiness.score)) out of 100")
        .onAppear {
            withAnimation(Animate.gentle) {
                animatedProgress = min(readiness.score / 100, 1.0)
            }
        }
    }

    // MARK: - Score Label

    private var scoreLabel: some View {
        Text(readiness.label)
            .font(Theme.Typography.calloutMedium)
            .foregroundStyle(labelColor)
    }

    // MARK: - Factor Pills

    private var factorPills: some View {
        HStack(spacing: Theme.Spacing.sm) {
            factorPill(
                icon: "bed.double",
                value: readiness.factors.sleep.formatted,
                trend: readiness.factors.sleep.trend
            )
            factorPill(
                icon: "heart.text.square",
                value: readiness.factors.hrv.formatted,
                trend: readiness.factors.hrv.trend
            )
            factorPill(
                icon: "heart",
                value: readiness.factors.rhr.formatted,
                trend: readiness.factors.rhr.trend
            )
            factorPill(
                icon: "flame",
                value: readiness.factors.load.formatted,
                trend: readiness.factors.load.trend
            )
        }
    }

    private func factorPill(icon: String, value: String, trend: String) -> some View {
        HStack(spacing: Theme.Spacing.xs) {
            Image(systemName: icon)
                .font(.system(size: 10))
            Text(value)
                .font(Theme.Typography.caption)
            Image(systemName: trendIcon(trend))
                .font(.system(size: 8))
        }
        .foregroundStyle(Theme.Colors.textSecondary)
        .padding(.horizontal, Theme.Spacing.sm)
        .padding(.vertical, Theme.Spacing.xs)
        .background(Theme.Colors.muted)
        .clipShape(Capsule())
    }

    // MARK: - Helpers

    private var ringColor: Color {
        let score = readiness.score
        if score >= 70 { return Theme.Colors.primary }
        if score >= 40 { return Theme.Colors.chart5 }
        return Theme.Colors.chart4
    }

    private var labelColor: Color {
        let score = readiness.score
        if score >= 70 { return Theme.Colors.primary }
        if score >= 40 { return Theme.Colors.chart5 }
        return Theme.Colors.chart4
    }

    private func trendIcon(_ trend: String) -> String {
        switch trend {
        case "up": return "arrow.up.right"
        case "down": return "arrow.down.right"
        default: return "arrow.right"
        }
    }
}
