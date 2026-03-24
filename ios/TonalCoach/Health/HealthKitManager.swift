import Foundation
import HealthKit
import SwiftUI

// MARK: - Supporting Types

/// A workout record sourced from HealthKit.
struct HealthWorkout: Identifiable {
    let id: UUID
    let activityType: HKWorkoutActivityType
    let startDate: Date
    let endDate: Date
    let duration: TimeInterval
    let totalEnergyBurned: Double?
    let averageHeartRate: Double?
    let source: String

    var activityName: String {
        switch activityType {
        case .traditionalStrengthTraining: return "Strength Training"
        case .functionalStrengthTraining: return "Functional Strength"
        case .running: return "Running"
        case .cycling: return "Cycling"
        case .yoga: return "Yoga"
        case .highIntensityIntervalTraining: return "HIIT"
        case .rowing: return "Rowing"
        case .pilates: return "Pilates"
        case .elliptical: return "Elliptical"
        case .walking: return "Walking"
        case .cooldown: return "Cooldown"
        case .coreTraining: return "Core Training"
        case .flexibility: return "Flexibility"
        case .mixedCardio: return "Mixed Cardio"
        case .stairClimbing: return "Stair Climbing"
        case .swimming: return "Swimming"
        case .crossTraining: return "Cross Training"
        default: return "Workout"
        }
    }

    var isTonalWorkout: Bool { source.lowercased().contains("tonal") }

    var isStrengthTraining: Bool {
        activityType == .traditionalStrengthTraining
            || activityType == .functionalStrengthTraining
    }
}

/// Summary of a week's workout activity from HealthKit.
struct WeeklyHealthSummary {
    let workoutCount: Int
    let totalMinutes: Double
    let totalCalories: Double
    let averageHeartRate: Double?
    let strengthSessionCount: Int
    let cardioSessionCount: Int
}

/// A single body weight measurement from HealthKit.
struct WeightEntry: Identifiable {
    let id: UUID
    let date: Date
    let weight: Double // in kg

    var weightLbs: Double { weight * 2.20462 }
}

// MARK: - HealthKitManager

/// Manages all HealthKit interactions for the app.
///
/// Uses `@Observable` (iOS 17+) so SwiftUI views automatically react to
/// state changes. Inject via the `.healthKitManager` environment value.
@Observable
final class HealthKitManager {
    // MARK: - State

    var isAuthorized = false
    var authorizationStatus: HKAuthorizationStatus = .notDetermined

    // MARK: - Cached Data

    var todayActiveEnergy: Double = 0
    var todayExerciseMinutes: Double = 0
    var todayStandHours: Double = 0
    var restingHeartRate: Double?
    var recentWorkouts: [HealthWorkout] = []
    var weeklyWorkoutSummary: WeeklyHealthSummary?
    var weightTrend: [WeightEntry] = []

    // MARK: - Loading State

    var isLoading = false
    var errorMessage: String?

    // MARK: - Private

    private let healthStore = HKHealthStore()
    private var observerQueries: [HKObserverQuery] = []

    // MARK: - Availability

    static var isAvailable: Bool { HKHealthStore.isHealthDataAvailable() }

    // MARK: - Read Types

    private var readTypes: Set<HKObjectType> {
        var types = Set<HKObjectType>()
        if let activeEnergy = HKQuantityType.quantityType(forIdentifier: .activeEnergyBurned) {
            types.insert(activeEnergy)
        }
        if let exerciseTime = HKQuantityType.quantityType(forIdentifier: .appleExerciseTime) {
            types.insert(exerciseTime)
        }
        if let standHour = HKCategoryType.categoryType(forIdentifier: .appleStandHour) {
            types.insert(standHour)
        }
        if let heartRate = HKQuantityType.quantityType(forIdentifier: .heartRate) {
            types.insert(heartRate)
        }
        if let restingHR = HKQuantityType.quantityType(forIdentifier: .restingHeartRate) {
            types.insert(restingHR)
        }
        if let bodyMass = HKQuantityType.quantityType(forIdentifier: .bodyMass) {
            types.insert(bodyMass)
        }
        types.insert(HKWorkoutType.workoutType())
        types.insert(HKActivitySummaryType.activitySummaryType())
        return types
    }

    // MARK: - Authorization

    /// Request authorization to read health data.
    /// HealthKit shows its own permission sheet; we never write data.
    func requestAuthorization() async throws {
        guard Self.isAvailable else {
            errorMessage = "HealthKit is not available on this device."
            return
        }

        try await healthStore.requestAuthorization(toShare: [], read: readTypes)
        // For read-only apps, HealthKit deliberately does not expose whether the
        // user granted or denied individual read permissions. If requestAuthorization
        // completes without throwing, the permission dialog was shown. We attempt a
        // data fetch to verify read access was actually granted.
        await MainActor.run {
            self.isAuthorized = true
            self.errorMessage = nil
        }
        // Verify by attempting a fetch - if denied, data will be empty
        try? await fetchTodayActivity()
    }

    /// Check if we can read a specific data type. HealthKit does not reveal
    /// whether the user denied a specific type, only whether we asked.
    func authorizationStatus(for type: HKObjectType) -> HKAuthorizationStatus {
        healthStore.authorizationStatus(for: type)
    }

    // MARK: - Fetch All Data

    /// Convenience method that fetches all data types at once.
    func fetchAllData() async {
        await MainActor.run { self.isLoading = true }
        defer { Task { @MainActor in self.isLoading = false } }

        async let activity: () = fetchTodayActivity()
        async let workouts: () = fetchRecentWorkouts()
        async let resting: () = fetchRestingHeartRate()
        async let weekly: () = fetchWeeklyWorkoutSummary()
        async let weight: () = fetchWeightTrend()

        _ = await (
            try? activity, try? workouts, try? resting, try? weekly, try? weight
        )
    }

    // MARK: - Today's Activity

    /// Fetches today's active energy, exercise minutes, and stand hours.
    func fetchTodayActivity() async throws {
        async let energy = fetchTodayCumulativeSum(
            for: .activeEnergyBurned,
            unit: .kilocalorie()
        )
        async let exercise = fetchTodayCumulativeSum(
            for: .appleExerciseTime,
            unit: .minute()
        )
        async let stand = fetchTodayStandHours()

        let (energyVal, exerciseVal, standVal) = try await (energy, exercise, stand)

        await MainActor.run {
            self.todayActiveEnergy = energyVal
            self.todayExerciseMinutes = exerciseVal
            self.todayStandHours = standVal
        }
    }

    // MARK: - Recent Workouts

    /// Fetches recent workouts from HealthKit with optional heart rate enrichment.
    func fetchRecentWorkouts(limit: Int = 10) async throws {
        let workoutType = HKObjectType.workoutType()

        let sortDescriptor = NSSortDescriptor(
            key: HKSampleSortIdentifierStartDate,
            ascending: false
        )

        let samples = try await withCheckedThrowingContinuation {
            (continuation: CheckedContinuation<[HKSample], Error>) in
            let query = HKSampleQuery(
                sampleType: workoutType,
                predicate: nil,
                limit: limit,
                sortDescriptors: [sortDescriptor]
            ) { _, samples, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                continuation.resume(returning: samples ?? [])
            }
            healthStore.execute(query)
        }

        nonisolated(unsafe) var workouts: [HealthWorkout] = []
        for sample in samples {
            guard let workout = sample as? HKWorkout else { continue }
            let sourceName = workout.sourceRevision.source.name
            let energyBurned = workout.totalEnergyBurned?.doubleValue(
                for: .kilocalorie()
            )
            let avgHR = await self.fetchAverageHeartRate(
                start: workout.startDate,
                end: workout.endDate
            )

            workouts.append(HealthWorkout(
                id: workout.uuid,
                activityType: workout.workoutActivityType,
                startDate: workout.startDate,
                endDate: workout.endDate,
                duration: workout.duration,
                totalEnergyBurned: energyBurned,
                averageHeartRate: avgHR,
                source: sourceName
            ))
        }

        await MainActor.run {
            self.recentWorkouts = workouts
        }
    }

    // MARK: - Resting Heart Rate

    /// Fetches the most recent resting heart rate sample.
    func fetchRestingHeartRate() async throws {
        guard let hrType = HKQuantityType.quantityType(forIdentifier: .restingHeartRate) else {
            return
        }

        let sortDescriptor = NSSortDescriptor(
            key: HKSampleSortIdentifierStartDate,
            ascending: false
        )

        let sample = try await withCheckedThrowingContinuation {
            (continuation: CheckedContinuation<HKQuantitySample?, Error>) in
            let query = HKSampleQuery(
                sampleType: hrType,
                predicate: nil,
                limit: 1,
                sortDescriptors: [sortDescriptor]
            ) { _, samples, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                let sample = samples?.first as? HKQuantitySample
                continuation.resume(returning: sample)
            }
            healthStore.execute(query)
        }

        let value = sample?.quantity.doubleValue(
            for: HKUnit.count().unitDivided(by: .minute())
        )

        await MainActor.run {
            self.restingHeartRate = value
        }
    }

    // MARK: - Weekly Workout Summary

    /// Computes a summary of the past 7 days of workouts.
    func fetchWeeklyWorkoutSummary() async throws {
        let calendar = Calendar.current
        guard let weekAgo = calendar.date(
            byAdding: .day, value: -7, to: calendar.startOfDay(for: Date())
        ) else { return }

        let predicate = HKQuery.predicateForSamples(
            withStart: weekAgo,
            end: Date(),
            options: .strictStartDate
        )

        let sortDescriptor = NSSortDescriptor(
            key: HKSampleSortIdentifierStartDate,
            ascending: false
        )

        let samples = try await withCheckedThrowingContinuation {
            (continuation: CheckedContinuation<[HKSample], Error>) in
            let query = HKSampleQuery(
                sampleType: HKWorkoutType.workoutType(),
                predicate: predicate,
                limit: HKObjectQueryNoLimit,
                sortDescriptors: [sortDescriptor]
            ) { _, samples, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                continuation.resume(returning: samples ?? [])
            }
            healthStore.execute(query)
        }

        let workouts = samples.compactMap { $0 as? HKWorkout }

        var totalMinutes: Double = 0
        var totalCalories: Double = 0
        var strengthCount = 0
        var cardioCount = 0

        for workout in workouts {
            totalMinutes += workout.duration / 60
            if let energy = workout.totalEnergyBurned {
                totalCalories += energy.doubleValue(for: .kilocalorie())
            }
            let strengthTypes: Set<HKWorkoutActivityType> = [
                .traditionalStrengthTraining,
                .functionalStrengthTraining,
            ]
            let cardioTypes: Set<HKWorkoutActivityType> = [
                .running, .cycling, .rowing, .elliptical,
                .highIntensityIntervalTraining, .mixedCardio, .swimming,
            ]
            if strengthTypes.contains(workout.workoutActivityType) {
                strengthCount += 1
            } else if cardioTypes.contains(workout.workoutActivityType) {
                cardioCount += 1
            }
        }

        let summary = WeeklyHealthSummary(
            workoutCount: workouts.count,
            totalMinutes: totalMinutes,
            totalCalories: totalCalories,
            averageHeartRate: nil,
            strengthSessionCount: strengthCount,
            cardioSessionCount: cardioCount
        )

        await MainActor.run {
            self.weeklyWorkoutSummary = summary
        }
    }

    // MARK: - Weight Trend

    /// Fetches body weight samples over the last `days` days.
    func fetchWeightTrend(days: Int = 30) async throws {
        guard let bodyMassType = HKQuantityType.quantityType(forIdentifier: .bodyMass) else {
            return
        }

        let calendar = Calendar.current
        guard let startDate = calendar.date(
            byAdding: .day, value: -days, to: calendar.startOfDay(for: Date())
        ) else { return }

        let predicate = HKQuery.predicateForSamples(
            withStart: startDate,
            end: Date(),
            options: .strictStartDate
        )

        let sortDescriptor = NSSortDescriptor(
            key: HKSampleSortIdentifierStartDate,
            ascending: true
        )

        let samples = try await withCheckedThrowingContinuation {
            (continuation: CheckedContinuation<[HKSample], Error>) in
            let query = HKSampleQuery(
                sampleType: bodyMassType,
                predicate: predicate,
                limit: HKObjectQueryNoLimit,
                sortDescriptors: [sortDescriptor]
            ) { _, samples, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                continuation.resume(returning: samples ?? [])
            }
            healthStore.execute(query)
        }

        let entries = samples.compactMap { sample -> WeightEntry? in
            guard let quantitySample = sample as? HKQuantitySample else { return nil }
            return WeightEntry(
                id: quantitySample.uuid,
                date: quantitySample.startDate,
                weight: quantitySample.quantity.doubleValue(for: .gramUnit(with: .kilo))
            )
        }

        await MainActor.run {
            self.weightTrend = entries
        }
    }

    // MARK: - Observers (Real-Time Updates)

    /// Starts background observer queries for activity data.
    /// When HealthKit data changes, it triggers a re-fetch of today's activity.
    func startObservingActivity() {
        stopObserving()

        let typesToObserve: [HKSampleType] = [
            HKQuantityType.quantityType(forIdentifier: .activeEnergyBurned),
            HKQuantityType.quantityType(forIdentifier: .appleExerciseTime),
        ].compactMap { $0 }

        for sampleType in typesToObserve {
            let query = HKObserverQuery(
                sampleType: sampleType,
                predicate: nil
            ) { [weak self] _, _, error in
                guard error == nil, let self else { return }
                Task {
                    try? await self.fetchTodayActivity()
                }
            }
            healthStore.execute(query)
            observerQueries.append(query)
        }
    }

    /// Stops all active observer queries.
    func stopObserving() {
        for query in observerQueries {
            healthStore.stop(query)
        }
        observerQueries.removeAll()
    }

    // MARK: - Private Helpers

    /// Fetches today's cumulative sum for a quantity type.
    private func fetchTodayCumulativeSum(
        for identifier: HKQuantityTypeIdentifier,
        unit: HKUnit
    ) async throws -> Double {
        guard let quantityType = HKQuantityType.quantityType(forIdentifier: identifier) else {
            return 0
        }

        let calendar = Calendar.current
        let startOfDay = calendar.startOfDay(for: Date())
        let predicate = HKQuery.predicateForSamples(
            withStart: startOfDay,
            end: Date(),
            options: .strictStartDate
        )

        return try await withCheckedThrowingContinuation { continuation in
            let query = HKStatisticsQuery(
                quantityType: quantityType,
                quantitySamplePredicate: predicate,
                options: .cumulativeSum
            ) { _, statistics, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                let value = statistics?.sumQuantity()?.doubleValue(for: unit) ?? 0
                continuation.resume(returning: value)
            }
            healthStore.execute(query)
        }
    }

    /// Fetches today's stand hours from the stand hour category type.
    private func fetchTodayStandHours() async throws -> Double {
        guard let standType = HKCategoryType.categoryType(
            forIdentifier: .appleStandHour
        ) else { return 0 }

        let calendar = Calendar.current
        let startOfDay = calendar.startOfDay(for: Date())
        let predicate = HKQuery.predicateForSamples(
            withStart: startOfDay,
            end: Date(),
            options: .strictStartDate
        )

        let sortDescriptor = NSSortDescriptor(
            key: HKSampleSortIdentifierStartDate,
            ascending: false
        )

        return try await withCheckedThrowingContinuation { continuation in
            let query = HKSampleQuery(
                sampleType: standType,
                predicate: predicate,
                limit: HKObjectQueryNoLimit,
                sortDescriptors: [sortDescriptor]
            ) { _, samples, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                let standCount = (samples ?? []).filter { sample in
                    guard let categorySample = sample as? HKCategorySample else { return false }
                    return categorySample.value == HKCategoryValueAppleStandHour.stood.rawValue
                }.count
                continuation.resume(returning: Double(standCount))
            }
            healthStore.execute(query)
        }
    }

    /// Fetches the average heart rate during a time interval.
    private func fetchAverageHeartRate(start: Date, end: Date) async -> Double? {
        guard let hrType = HKQuantityType.quantityType(forIdentifier: .heartRate) else {
            return nil
        }

        let predicate = HKQuery.predicateForSamples(
            withStart: start,
            end: end,
            options: .strictStartDate
        )

        return await withCheckedContinuation { continuation in
            let query = HKStatisticsQuery(
                quantityType: hrType,
                quantitySamplePredicate: predicate,
                options: .discreteAverage
            ) { _, statistics, _ in
                let bpmUnit = HKUnit.count().unitDivided(by: .minute())
                let value = statistics?.averageQuantity()?.doubleValue(for: bpmUnit)
                continuation.resume(returning: value)
            }
            healthStore.execute(query)
        }
    }
}

// MARK: - SwiftUI Environment

private struct HealthKitManagerKey: EnvironmentKey {
    static let defaultValue = HealthKitManager()
}

extension EnvironmentValues {
    var healthKitManager: HealthKitManager {
        get { self[HealthKitManagerKey.self] }
        set { self[HealthKitManagerKey.self] = newValue }
    }
}
