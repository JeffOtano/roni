import SwiftUI

/// Reusable animated 7-day sparkline that draws a line path connecting non-nil data points.
/// Animates left-to-right on appear using `.trim` and `Animate.gentle`.
struct SparklineView: View {
    let values: [Double?]
    var color: Color = Theme.Colors.primary
    var height: CGFloat = 32

    @State private var animatedProgress: CGFloat = 0

    private var dataPoints: [(index: Int, value: Double)] {
        values.enumerated().compactMap { index, value in
            value.map { (index: index, value: $0) }
        }
    }

    var body: some View {
        GeometryReader { geometry in
            let width = geometry.size.width
            let drawHeight = geometry.size.height
            let points = dataPoints

            if points.count >= 2 {
                let minVal = points.map(\.value).min() ?? 0
                let maxVal = points.map(\.value).max() ?? 1
                let range = maxVal - minVal
                let safeRange = range > 0 ? range : 1

                let maxIndex = max(values.count - 1, 1)

                // Line path
                Path { path in
                    for (i, point) in points.enumerated() {
                        let x = (CGFloat(point.index) / CGFloat(maxIndex)) * width
                        let y = drawHeight - ((point.value - minVal) / safeRange) * drawHeight
                        if i == 0 {
                            path.move(to: CGPoint(x: x, y: y))
                        } else {
                            path.addLine(to: CGPoint(x: x, y: y))
                        }
                    }
                }
                .trim(from: 0, to: animatedProgress)
                .stroke(color, style: StrokeStyle(lineWidth: 1.5, lineCap: .round, lineJoin: .round))

                // Data point circles
                ForEach(points, id: \.index) { point in
                    let x = (CGFloat(point.index) / CGFloat(maxIndex)) * width
                    let y = drawHeight - ((point.value - minVal) / safeRange) * drawHeight
                    Circle()
                        .fill(color)
                        .frame(width: 4, height: 4)
                        .position(x: x, y: y)
                        .opacity(animatedProgress > 0 ? 1 : 0)
                }
            }
        }
        .frame(height: height)
        .onAppear {
            withAnimation(Animate.gentle) {
                animatedProgress = 1
            }
        }
    }
}
