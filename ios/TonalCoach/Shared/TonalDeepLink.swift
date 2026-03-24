import Foundation
import SwiftUI

/// Represents a deep link the app can handle via universal links or custom URL scheme.
///
/// Supported link formats:
/// - `link.tonal.com/custom-workout/{uuid}` - Tonal workout deep links
/// - `tonal.coach/workouts/{slug}` - Our own workout URLs
/// - `tonalcoach://` custom scheme (future use)
enum TonalDeepLink {
    case tonalWorkout(id: String)
    case workout(slug: String)
    case unknown

    init(url: URL) {
        let host = url.host(percentEncoded: false) ?? ""
        let pathComponents = url.pathComponents.filter { $0 != "/" }

        switch host {
        case "link.tonal.com":
            // Format: link.tonal.com/custom-workout/{uuid}
            if pathComponents.count >= 2,
               pathComponents[0] == "custom-workout"
            {
                self = .tonalWorkout(id: pathComponents[1])
            } else {
                self = .unknown
            }

        case "tonal.coach", "www.tonal.coach":
            // Format: tonal.coach/workouts/{slug}
            if pathComponents.count >= 2,
               pathComponents[0] == "workouts"
            {
                self = .workout(slug: pathComponents[1])
            } else {
                self = .unknown
            }

        default:
            self = .unknown
        }
    }

    /// Open a Tonal deep link URL in the Tonal app.
    static func openInTonal(url: String) {
        guard let linkURL = URL(string: url) else { return }
        UIApplication.shared.open(linkURL)
    }
}
