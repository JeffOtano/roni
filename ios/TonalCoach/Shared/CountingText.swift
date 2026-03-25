import SwiftUI

struct CountingText: View {
    let target: Double
    let format: String
    let duration: Double
    let font: Font

    @State private var startTime: Date?
    @State private var displayValue: Double = 0

    init(
        target: Double,
        format: String = "%.0f",
        duration: Double = Animate.dataViz + 0.1,
        font: Font = Theme.Typography.monoText
    ) {
        self.target = target
        self.format = format
        self.duration = duration
        self.font = font
    }

    var body: some View {
        Group {
            if Animate.prefersReducedMotion {
                Text(String(format: format, target))
            } else {
                TimelineView(.animation) { timeline in
                    let now = timeline.date
                    let elapsed = startTime.map { now.timeIntervalSince($0) } ?? 0
                    let progress = min(elapsed / duration, 1.0)
                    let eased = 1.0 - pow(1.0 - progress, 3)
                    let value = target * eased
                    Text(String(format: format, value))
                }
            }
        }
        .font(font)
        .monospacedDigit()
        .onAppear {
            if startTime == nil {
                startTime = Date()
            }
        }
    }
}
