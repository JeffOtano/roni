import SwiftUI

struct ShimmerView: View {
    let height: CGFloat
    var width: CGFloat? = nil
    var cornerRadius: CGFloat = Theme.CornerRadius.md

    var body: some View {
        RoundedRectangle(cornerRadius: cornerRadius)
            .fill(Theme.Colors.muted.opacity(0.8))
            .frame(width: width, height: height)
            .shimmer()
    }
}

struct ShimmerModifier: ViewModifier {
    @State private var phase: CGFloat = -1

    func body(content: Content) -> some View {
        content
            .overlay(
                LinearGradient(
                    colors: [.clear, Color.white.opacity(0.15), .clear],
                    startPoint: .leading,
                    endPoint: .trailing
                )
                .offset(x: phase * 300)
                .clipped()
            )
            .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.md))
            .onAppear {
                if Animate.prefersReducedMotion { return }
                withAnimation(
                    .linear(duration: 1.2)
                    .repeatForever(autoreverses: false)
                    .delay(0.4)
                ) {
                    phase = 1
                }
            }
    }
}

extension View {
    func shimmer() -> some View {
        modifier(ShimmerModifier())
    }
}
