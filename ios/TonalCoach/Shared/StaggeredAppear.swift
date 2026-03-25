import SwiftUI

struct StaggeredAppear: ViewModifier {
    let index: Int
    let staggerInterval: Double

    @State private var hasAppeared = false

    func body(content: Content) -> some View {
        content
            .opacity(hasAppeared ? 1 : 0)
            .offset(y: hasAppeared ? 0 : 12)
            .onAppear {
                guard !hasAppeared else { return }
                let delay = Animate.staggerDelay(index: index, interval: staggerInterval)
                withAnimation(Animate.smooth.delay(delay)) {
                    hasAppeared = true
                }
            }
    }
}

extension View {
    func staggeredAppear(index: Int, interval: Double = Animate.cardStagger) -> some View {
        modifier(StaggeredAppear(index: index, staggerInterval: interval))
    }
}
