import ConvexMobile
import Foundation

// ConvexInt, OptionalConvexInt, ConvexFloat, OptionalConvexFloat are provided
// by the ConvexMobile SDK (Decoding.swift). They decode Convex's base64-encoded
// integer wire format correctly. Do NOT redefine them here.

// MARK: - Library Workout Enums

/// Session types available for library workouts.
/// Matches `LibrarySessionType` in `convex/coach/goalConfig.ts`.
enum SessionType: String, Codable, CaseIterable, Identifiable {
    case push
    case pull
    case legs
    case upper
    case lower
    case fullBody = "full_body"
    case chest
    case back
    case shoulders
    case arms
    case core
    case glutesHamstrings = "glutes_hamstrings"
    case chestBack = "chest_back"
    case mobility
    case recovery

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .push: "Push"
        case .pull: "Pull"
        case .legs: "Legs"
        case .upper: "Upper Body"
        case .lower: "Lower Body"
        case .fullBody: "Full Body"
        case .chest: "Chest"
        case .back: "Back"
        case .shoulders: "Shoulders"
        case .arms: "Arms"
        case .core: "Core"
        case .glutesHamstrings: "Glutes & Hamstrings"
        case .chestBack: "Chest & Back"
        case .mobility: "Mobility"
        case .recovery: "Recovery"
        }
    }
}

/// Workout goals for library workouts.
/// Matches `LibraryGoal` in `convex/coach/goalConfig.ts`.
enum WorkoutGoal: String, Codable, CaseIterable, Identifiable {
    case buildMuscle = "build_muscle"
    case fatLoss = "fat_loss"
    case strength
    case endurance
    case athletic
    case generalFitness = "general_fitness"
    case power
    case functional
    case mobilityFlexibility = "mobility_flexibility"
    case sportComplement = "sport_complement"

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .buildMuscle: "Build Muscle"
        case .fatLoss: "Fat Loss"
        case .strength: "Strength"
        case .endurance: "Endurance"
        case .athletic: "Athletic"
        case .generalFitness: "General Fitness"
        case .power: "Power"
        case .functional: "Functional"
        case .mobilityFlexibility: "Mobility & Flexibility"
        case .sportComplement: "Sport Complement"
        }
    }
}

/// Workout difficulty levels.
/// Matches `LibraryLevel` in `convex/coach/goalConfig.ts`.
enum WorkoutLevel: String, Codable, CaseIterable, Identifiable {
    case beginner
    case intermediate
    case advanced

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .beginner: "Beginner"
        case .intermediate: "Intermediate"
        case .advanced: "Advanced"
        }
    }
}

/// Equipment configurations for library workouts.
/// Matches `LibraryEquipmentConfig` in `convex/coach/goalConfig.ts`.
enum EquipmentConfig: String, Codable, CaseIterable, Identifiable {
    case handlesOnly = "handles_only"
    case handlesBar = "handles_bar"
    case fullAccessories = "full_accessories"
    case bodyweightOnly = "bodyweight_only"

    var id: String { rawValue }

    var displayName: String {
        switch self {
        case .handlesOnly: "Handles Only"
        case .handlesBar: "Handles + Bar"
        case .fullAccessories: "Full Accessories"
        case .bodyweightOnly: "Bodyweight Only"
        }
    }
}

/// Available workout durations in minutes.
/// Matches `LibraryDuration` in `convex/coach/goalConfig.ts`.
enum WorkoutDuration: Int, Codable, CaseIterable, Identifiable {
    case twenty = 20
    case thirty = 30
    case fortyFive = 45
    case sixty = 60

    var id: Int { rawValue }

    var displayName: String {
        "\(rawValue) min"
    }
}

/// Movement phase within a workout.
/// Matches the `phase` union in `libraryWorkouts.movementDetails` schema.
enum MovementPhase: String, Codable {
    case warmup
    case main
    case cooldown
}

// MARK: - Library Workout Card

/// Projected card data returned by `libraryWorkouts:listFiltered`.
/// Matches the `projectCardData` function in `convex/libraryWorkouts.ts`.
struct WorkoutCard: Identifiable, Decodable, Hashable {
    let _id: String
    let slug: String
    let title: String
    let description: String
    let sessionType: String
    let goal: String
    @ConvexInt var durationMinutes: Int
    let level: String
    @ConvexInt var exerciseCount: Int
    @ConvexInt var totalSets: Int
    let equipmentConfig: String
    let targetMuscleGroups: [String]
    let equipmentNeeded: [String]

    var id: String { slug }

    // Hashable conformance (ConvexInt doesn't auto-conform)
    static func == (lhs: WorkoutCard, rhs: WorkoutCard) -> Bool {
        lhs.slug == rhs.slug
    }

    func hash(into hasher: inout Hasher) {
        hasher.combine(slug)
    }

    // Typed accessors
    var sessionTypeEnum: SessionType? { SessionType(rawValue: sessionType) }
    var goalEnum: WorkoutGoal? { WorkoutGoal(rawValue: goal) }
    var levelEnum: WorkoutLevel? { WorkoutLevel(rawValue: level) }
    var equipmentConfigEnum: EquipmentConfig? { EquipmentConfig(rawValue: equipmentConfig) }
}

// MARK: - Full Library Workout Detail

/// Full workout data returned by `libraryWorkouts:getBySlug`.
/// Matches the `libraryWorkouts` table in `convex/schema.ts`.
struct LibraryWorkout: Decodable {
    let _id: String
    let slug: String
    let title: String
    let description: String
    let sessionType: String
    let goal: String
    @ConvexInt var durationMinutes: Int
    let level: String
    let equipmentConfig: String
    let blocks: [WorkoutBlock]
    let movementDetails: [MovementDetail]
    let targetMuscleGroups: [String]
    @ConvexInt var exerciseCount: Int
    @ConvexInt var totalSets: Int
    let equipmentNeeded: [String]
    let restGuidance: String?
    let workoutRationale: String?
    let whoIsThisFor: String?
    let faq: [FAQ]?
    let tonalDeepLinkUrl: String?

    // Typed accessors
    var sessionTypeEnum: SessionType? { SessionType(rawValue: sessionType) }
    var goalEnum: WorkoutGoal? { WorkoutGoal(rawValue: goal) }
    var levelEnum: WorkoutLevel? { WorkoutLevel(rawValue: level) }
    var equipmentConfigEnum: EquipmentConfig? { EquipmentConfig(rawValue: equipmentConfig) }
}

// MARK: - Workout Structure Types

/// A block of exercises in a workout (superset grouping).
/// Matches `blockInputValidator` in `convex/validators.ts`.
struct WorkoutBlock: Decodable {
    let exercises: [BlockExercise]
}

/// A single exercise entry within a workout block.
struct BlockExercise: Decodable {
    let movementId: String
    @ConvexInt var sets: Int
    @OptionalConvexInt var reps: Int?
    @OptionalConvexInt var duration: Int?
    let spotter: Bool?
    let eccentric: Bool?
    let chains: Bool?
    let burnout: Bool?
    let dropSet: Bool?
    let warmUp: Bool?
}

/// Enriched movement info attached to a library workout.
/// Matches `movementDetails` array in `libraryWorkouts` schema.
struct MovementDetail: Decodable, Identifiable {
    let movementId: String
    let name: String
    let shortName: String
    let muscleGroups: [String]
    @ConvexInt var sets: Int
    @OptionalConvexInt var reps: Int?
    @OptionalConvexInt var duration: Int?
    let phase: String
    let thumbnailMediaUrl: String?
    let accessory: String?
    let coachingCue: String?

    var id: String { movementId }

    var phaseEnum: MovementPhase? { MovementPhase(rawValue: phase) }
}

/// FAQ entry for a library workout.
struct FAQ: Decodable, Identifiable {
    let question: String
    let answer: String

    var id: String { question }
}

// MARK: - Related Workout Card

/// Compact related workout data returned by `libraryWorkouts:getRelated`.
/// Matches the projection in the `getRelated` query handler.
struct RelatedWorkoutCard: Decodable, Identifiable, Hashable {
    let slug: String
    let title: String
    let sessionType: String
    let goal: String
    @ConvexInt var durationMinutes: Int
    let level: String
    @ConvexInt var exerciseCount: Int

    var id: String { slug }

    static func == (lhs: RelatedWorkoutCard, rhs: RelatedWorkoutCard) -> Bool {
        lhs.slug == rhs.slug
    }

    func hash(into hasher: inout Hasher) {
        hasher.combine(slug)
    }
}

// MARK: - Pagination

/// Convex paginated query response wrapper.
/// Matches the shape returned by Convex's `.paginate()` method.
struct PaginatedResponse<T: Decodable>: Decodable {
    let page: [T]
    let isDone: Bool
    let continueCursor: String

    /// Convex returns the cursor as a string; nil means we're at the start.
    var hasMore: Bool { !isDone }
}

// MARK: - Filters

/// Client-side filter state for the workout library browse view.
struct WorkoutFilters: Equatable {
    var sessionTypes: Set<String> = []
    var goals: Set<String> = []
    var levels: Set<String> = []
    var equipmentConfigs: Set<String> = []
    var durationMinutes: Int?

    var isEmpty: Bool {
        sessionTypes.isEmpty
            && goals.isEmpty
            && levels.isEmpty
            && equipmentConfigs.isEmpty
            && durationMinutes == nil
    }

    var activeFilterCount: Int {
        var count = 0
        if !sessionTypes.isEmpty { count += sessionTypes.count }
        if !goals.isEmpty { count += goals.count }
        if !levels.isEmpty { count += levels.count }
        if !equipmentConfigs.isEmpty { count += equipmentConfigs.count }
        if durationMinutes != nil { count += 1 }
        return count
    }

    mutating func clear() {
        sessionTypes.removeAll()
        goals.removeAll()
        levels.removeAll()
        equipmentConfigs.removeAll()
        durationMinutes = nil
    }

    /// Whether any filter is active.
    var hasActiveFilters: Bool { !isEmpty }

    /// Clears all active filters.
    mutating func clearAll() { clear() }

    /// Returns the active filters as (key, label) pairs for display as removable pills.
    var activeFilterPairs: [(key: String, label: String)] {
        var pairs: [(key: String, label: String)] = []
        for st in sessionTypes.sorted() {
            pairs.append((key: "sessionType:\(st)", label: sessionTypeDisplayName(st)))
        }
        for g in goals.sorted() {
            pairs.append((key: "goal:\(g)", label: goalDisplayName(g)))
        }
        for l in levels.sorted() {
            pairs.append((key: "level:\(l)", label: l.capitalized))
        }
        if let d = durationMinutes {
            pairs.append((key: "duration", label: "\(d) min"))
        }
        return pairs
    }

    /// Removes a filter identified by composite key (e.g., "sessionType:push" or "duration").
    mutating func removeFilter(for compositeKey: String) {
        if compositeKey == "duration" {
            durationMinutes = nil
            return
        }
        let parts = compositeKey.split(separator: ":", maxSplits: 1)
        guard parts.count == 2 else { return }
        let dimension = String(parts[0])
        let value = String(parts[1])
        switch dimension {
        case "sessionType": sessionTypes.remove(value)
        case "goal": goals.remove(value)
        case "level": levels.remove(value)
        default: break
        }
    }

    /// Build the args dictionary for `libraryWorkouts:listFiltered`.
    /// The Convex query accepts at most one value per filter dimension.
    func toQueryArgs() -> [String: ConvexEncodable?] {
        var args: [String: ConvexEncodable?] = [:]
        if let sessionType = sessionTypes.first, sessionTypes.count == 1 {
            args["sessionType"] = sessionType
        }
        if let goal = goals.first, goals.count == 1 {
            args["goal"] = goal
        }
        if let level = levels.first, levels.count == 1 {
            args["level"] = level
        }
        if let duration = durationMinutes {
            args["durationMinutes"] = duration
        }
        return args
    }

    private func sessionTypeDisplayName(_ type: String) -> String {
        let map: [String: String] = [
            "push": "Push", "pull": "Pull", "legs": "Legs",
            "upper": "Upper Body", "lower": "Lower Body", "full_body": "Full Body",
            "chest": "Chest", "back": "Back", "shoulders": "Shoulders",
            "arms": "Arms", "core": "Core", "glutes_hamstrings": "Glutes & Hamstrings",
            "chest_back": "Chest & Back", "mobility": "Mobility", "recovery": "Recovery",
        ]
        return map[type] ?? type.replacingOccurrences(of: "_", with: " ").capitalized
    }

    private func goalDisplayName(_ goal: String) -> String {
        let map: [String: String] = [
            "build_muscle": "Hypertrophy", "fat_loss": "Fat Loss", "strength": "Strength",
            "endurance": "Endurance", "athletic": "Athletic", "general_fitness": "General Fitness",
            "power": "Power", "functional": "Functional", "mobility_flexibility": "Mobility",
            "sport_complement": "Sport Complement",
        ]
        return map[goal] ?? goal.replacingOccurrences(of: "_", with: " ").capitalized
    }
}
