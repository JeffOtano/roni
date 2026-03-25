import SwiftUI

enum Animate {
    // MARK: - Spring Presets
    static let snappy: Animation = .spring(response: 0.3, dampingFraction: 0.7)
    static let smooth: Animation = .spring(response: 0.5, dampingFraction: 0.8)
    static let gentle: Animation = .spring(response: 0.8, dampingFraction: 0.85)

    // MARK: - Durations
    static let quickFeedback: Double = 0.15
    static let standard: Double = 0.2
    static let contentReveal: Double = 0.3
    static let dataViz: Double = 0.7

    // MARK: - Stagger Intervals
    static let cardStagger: Double = 0.06
    static let cellStagger: Double = 0.04
    static let rowStagger: Double = 0.05
    static let barStagger: Double = 0.08
    static let chipStagger: Double = 0.04

    // MARK: - Reduce Motion Helper
    static var prefersReducedMotion: Bool {
        UIAccessibility.isReduceMotionEnabled
    }

    static func staggerDelay(index: Int, interval: Double) -> Double {
        prefersReducedMotion ? 0 : Double(index) * interval
    }
}
