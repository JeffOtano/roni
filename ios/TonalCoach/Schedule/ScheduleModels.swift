import Foundation

// MARK: - Schedule Data

/// Top-level response from `schedule:getScheduleData` action.
struct ScheduleData: Decodable {
    let weekStartDate: String
    let days: [ScheduleDay]
}

// MARK: - Schedule Day

/// A single day in the weekly schedule (Mon-Sun).
///
/// `dayIndex` is 0-6 (Monday-Sunday). `derivedStatus` values:
/// completed, programmed, missed, failed, rest.
struct ScheduleDay: Decodable, Identifiable, Hashable {
    let dayIndex: Int
    let dayName: String
    let date: String
    let sessionType: String
    let derivedStatus: String
    let workoutTitle: String?
    let exercises: [ScheduleExercise]?
    let estimatedDuration: Int?
    let tonalWorkoutId: String?

    var id: Int { dayIndex }
    var isRest: Bool { derivedStatus == "rest" }
    var isTraining: Bool { !isRest }

    // MARK: Hashable (for NavigationLink value-based navigation)

    static func == (lhs: ScheduleDay, rhs: ScheduleDay) -> Bool {
        lhs.dayIndex == rhs.dayIndex
    }

    func hash(into hasher: inout Hasher) {
        hasher.combine(dayIndex)
    }
}

// MARK: - Schedule Exercise

/// An exercise within a scheduled day's workout.
struct ScheduleExercise: Decodable, Identifiable {
    let name: String
    let sets: Int
    let reps: Int?
    let duration: Int?

    var id: String { name }

    /// Human-readable volume text: "3 x 10" or "3 x 30s".
    var volumeText: String {
        if let reps {
            return "\(sets) x \(reps)"
        } else if let duration {
            return "\(sets) x \(duration)s"
        }
        return "\(sets) sets"
    }
}
