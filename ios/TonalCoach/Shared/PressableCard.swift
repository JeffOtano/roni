import SwiftUI

struct PressableCardStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1.0)
            .animation(Animate.snappy, value: configuration.isPressed)
            .onChange(of: configuration.isPressed) { _, isPressed in
                if !isPressed {
                    HapticEngine.tap()
                }
            }
    }
}

extension View {
    func pressableCard() -> some View {
        self.buttonStyle(PressableCardStyle())
    }
}
