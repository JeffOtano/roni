import Foundation

// MARK: - User Info (from users:getMe query)

struct UserInfo: Decodable {
    let userId: String
    let email: String?
    let hasTonalProfile: Bool
    let onboardingCompleted: Bool
    let tonalName: String?
    let tonalEmail: String?
    let tonalTokenExpired: Bool
}

// MARK: - Connect Result (from tonal/connectPublic:connectTonal)

struct ConnectTonalResult: Decodable {
    let success: Bool
    let tonalUserId: String
}

// MARK: - Strength (from dashboard:getStrengthData)

struct StrengthData: Decodable {
    let scores: [StrengthScore]
    let distribution: StrengthDistribution
}

struct StrengthScore: Decodable, Identifiable {
    let id: String
    let userId: String
    let strengthBodyRegion: String
    let bodyRegionDisplay: String
    let score: Double
    let current: Bool
}

struct StrengthDistribution: Decodable {
    let userId: String
    let overallScore: Double
    let percentile: Double
    let distributionPoints: [DistributionPoint]?
}

struct DistributionPoint: Decodable {
    let score: Double
    let yValue: Double
}

// MARK: - Muscle Readiness (from dashboard:getMuscleReadiness)

struct MuscleReadiness: Decodable {
    let Chest: Double
    let Shoulders: Double
    let Back: Double
    let Triceps: Double
    let Biceps: Double
    let Abs: Double
    let Obliques: Double
    let Quads: Double
    let Glutes: Double
    let Hamstrings: Double
    let Calves: Double

    var sorted: [(name: String, value: Double)] {
        [
            ("Chest", Chest), ("Shoulders", Shoulders), ("Back", Back),
            ("Triceps", Triceps), ("Biceps", Biceps), ("Abs", Abs),
            ("Obliques", Obliques), ("Quads", Quads), ("Glutes", Glutes),
            ("Hamstrings", Hamstrings), ("Calves", Calves),
        ].sorted { $0.value > $1.value }
    }
}

// MARK: - Workout Activity (from dashboard:getWorkoutHistory)

struct TonalActivity: Decodable, Identifiable {
    let activityId: String
    let activityTime: String
    let activityType: String
    let workoutPreview: WorkoutPreview
    var id: String { activityId }
}

struct WorkoutPreview: Decodable {
    let workoutTitle: String
    let targetArea: String
    let totalDuration: Double
    let totalVolume: Double
    let totalAchievements: Double
    let programName: String?
    let coachName: String?
    let level: String?
}

// MARK: - Training Frequency (from dashboard:getTrainingFrequency)

struct TrainingFrequencyEntry: Decodable, Identifiable {
    let targetArea: String
    let count: Int
    let lastTrainedDate: String
    var id: String { targetArea }
}

// MARK: - External Activity (from dashboard:getExternalActivities)

struct TonalExternalActivity: Decodable, Identifiable {
    let id: String
    let workoutType: String
    let beginTime: String
    let activeDuration: Double
    let activeCalories: Double
    let averageHeartRate: Double
    let source: String
}

// MARK: - Relative Time Helper

extension String {
    /// Parses an ISO 8601 date string and returns a relative time description.
    var relativeTime: String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        guard let date = formatter.date(from: self) ?? ISO8601DateFormatter().date(from: self) else {
            return self
        }
        let relative = RelativeDateTimeFormatter()
        relative.unitsStyle = .short
        return relative.localizedString(for: date, relativeTo: .now)
    }
}
