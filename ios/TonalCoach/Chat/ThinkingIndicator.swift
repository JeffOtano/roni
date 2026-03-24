import SwiftUI

// MARK: - Thinking Indicator

/// Animated thinking dots shown while waiting for the coach to respond.
///
/// Left-aligned like a coach bubble, with the same sparkles avatar.
/// Three dots pulse with staggered timing to convey active processing.
struct ThinkingIndicator: View {
    @State private var isAnimating = false

    var body: some View {
        HStack(alignment: .top, spacing: Theme.Spacing.sm) {
            // Coach avatar
            coachAvatar

            // Thinking dots bubble
            HStack(spacing: 6) {
                ForEach(0..<3, id: \.self) { index in
                    Circle()
                        .fill(Theme.Colors.textTertiary)
                        .frame(width: 8, height: 8)
                        .opacity(isAnimating ? 1.0 : 0.3)
                        .animation(
                            .easeInOut(duration: 0.6)
                                .repeatForever(autoreverses: true)
                                .delay(Double(index) * 0.2),
                            value: isAnimating
                        )
                }
            }
            .padding(.horizontal, Theme.Spacing.lg)
            .padding(.vertical, Theme.Spacing.md)
            .background(Theme.Colors.card)
            .clipShape(bubbleShape)
            .overlay(bubbleShape.stroke(Theme.Colors.border, lineWidth: 1))

            Spacer()
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Coach is thinking")
        .onAppear { isAnimating = true }
    }

    // MARK: - Coach Avatar

    private var coachAvatar: some View {
        ZStack {
            Circle()
                .fill(
                    LinearGradient(
                        colors: [Theme.Colors.primary, Color(hex: "9754ed")],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(width: 28, height: 28)
            Image(systemName: "sparkles")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(.white)
        }
    }

    // MARK: - Bubble Shape

    private var bubbleShape: UnevenRoundedRectangle {
        UnevenRoundedRectangle(
            topLeadingRadius: 16,
            bottomLeadingRadius: 8,
            bottomTrailingRadius: 16,
            topTrailingRadius: 16,
            style: .continuous
        )
    }
}
