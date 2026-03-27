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

/// Sleep analysis data derived from HealthKit sleep stage samples.
struct SleepData {
    let durationMinutes: Double
    let deepMinutes: Double?
    let remMinutes: Double?
    let coreMinutes: Double?
    let awakeMinutes: Double?
    let startTime: String?
    let endTime: String?
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
        if let sleep = HKCategoryType.categoryType(forIdentifier: .sleepAnalysis) { types.insert(sleep) }
        if let hrv = HKQuantityType.quantityType(forIdentifier: .heartRateVariabilitySDNN) { types.insert(hrv) }
        if let vo2 = HKQuantityType.quantityType(forIdentifier: .vo2Max) { types.insert(vo2) }
        if let hrRecovery = HKQuantityType.quantityType(forIdentifier: .heartRateRecoveryOneMinute) {
            types.insert(hrRecovery)
        }
        if let steps = HKQuantityType.quantityType(forIdentifier: .stepCount) { types.insert(steps) }
        if let flights = HKQuantityType.quantityType(forIdentifier: .flightsClimbed) { types.insert(flights) }
        if let bodyFat = HKQuantityType.quantityType(forIdentifier: .bodyFatPercentage) { types.insert(bodyFat) }
        if let leanMass = HKQuantityType.quantityType(forIdentifier: .leanBodyMass) { types.insert(leanMass) }
        if let calories = HKQuantityType.quantityType(forIdentifier: .dietaryEnergyConsumed) {
            types.insert(calories)
        }
        if let protein = HKQuantityType.quantityType(forIdentifier: .dietaryProtein) { types.insert(protein) }
        if #available(iOS 18.0, *) {
            if let effort = HKQuantityType.quantityType(forIdentifier: .workoutEffortScore) {
                types.insert(effort)
            }
        }
        if let respRate = HKQuantityType.quantityType(forIdentifier: .respiratoryRate) { types.insert(respRate) }
        if let spo2 = HKQuantityType.quantityType(forIdentifier: .oxygenSaturation) { types.insert(spo2) }
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
            guard let quantitySample = sample as? HKQuantitySample,
                  quantitySample.quantity.is(compatibleWith: .gramUnit(with: .kilo))
            else { return nil }
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
    func fetchTodayCumulativeSum(
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
                let sum = statistics?.sumQuantity()
                let value = (sum?.is(compatibleWith: unit) == true)
                    ? sum?.doubleValue(for: unit) ?? 0
                    : 0
                continuation.resume(returning: value)
            }
            healthStore.execute(query)
        }
    }

    /// Fetches last night's sleep data by querying yesterday 6 pm to today noon.
    ///
    /// Groups samples by sleep stage and returns total duration along with per-stage
    /// breakdowns and formatted bed/wake times.
    func fetchLastNightSleep() async throws -> SleepData? {
        guard let sleepType = HKCategoryType.categoryType(forIdentifier: .sleepAnalysis) else {
            return nil
        }

        let calendar = Calendar.current
        let now = Date()
        // Window: yesterday at 18:00 to today at 12:00
        guard
            let todayNoon = calendar.date(
                bySettingHour: 12, minute: 0, second: 0, of: now
            ),
            let yesterday = calendar.date(byAdding: .day, value: -1, to: now),
            let yesterdayEvening = calendar.date(
                bySettingHour: 18, minute: 0, second: 0, of: yesterday
            )
        else { return nil }

        let predicate = HKQuery.predicateForSamples(
            withStart: yesterdayEvening,
            end: todayNoon,
            options: .strictStartDate
        )

        let sortDescriptor = NSSortDescriptor(
            key: HKSampleSortIdentifierStartDate,
            ascending: true
        )

        let samples = try await withCheckedThrowingContinuation {
            (continuation: CheckedContinuation<[HKSample], Error>) in
            let query = HKSampleQuery(
                sampleType: sleepType,
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

        let categorySamples = samples.compactMap { $0 as? HKCategorySample }
        guard !categorySamples.isEmpty else { return nil }

        var deepSeconds: Double = 0
        var remSeconds: Double = 0
        var coreSeconds: Double = 0
        var awakeSeconds: Double = 0
        var unspecifiedSeconds: Double = 0

        for sample in categorySamples {
            let duration = sample.endDate.timeIntervalSince(sample.startDate)
            guard let stage = HKCategoryValueSleepAnalysis(rawValue: sample.value) else { continue }
            switch stage {
            case .asleepDeep:
                deepSeconds += duration
            case .asleepREM:
                remSeconds += duration
            case .asleepCore:
                coreSeconds += duration
            case .awake:
                awakeSeconds += duration
            case .asleepUnspecified, .inBed:
                unspecifiedSeconds += duration
            @unknown default:
                break
            }
        }

        let totalAsleepSeconds = deepSeconds + remSeconds + coreSeconds + unspecifiedSeconds
        let totalDurationMinutes = totalAsleepSeconds / 60

        let bedTime = categorySamples.first.map { formatTime($0.startDate) }
        let wakeTime = categorySamples.last.map { formatTime($0.endDate) }

        return SleepData(
            durationMinutes: totalDurationMinutes,
            deepMinutes: deepSeconds > 0 ? deepSeconds / 60 : nil,
            remMinutes: remSeconds > 0 ? remSeconds / 60 : nil,
            coreMinutes: coreSeconds > 0 ? coreSeconds / 60 : nil,
            awakeMinutes: awakeSeconds > 0 ? awakeSeconds / 60 : nil,
            startTime: bedTime,
            endTime: wakeTime
        )
    }

    /// Fetches the most recent sample value for a given quantity type identifier.
    func fetchLatestQuantity(
        for identifier: HKQuantityTypeIdentifier,
        unit: HKUnit
    ) async throws -> Double? {
        guard let quantityType = HKQuantityType.quantityType(forIdentifier: identifier) else {
            return nil
        }
        let sort = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)
        return try await withCheckedThrowingContinuation { continuation in
            let query = HKSampleQuery(
                sampleType: quantityType,
                predicate: nil,
                limit: 1,
                sortDescriptors: [sort]
            ) { _, samples, error in
                if let error { continuation.resume(throwing: error); return }
                let value: Double? = {
                    guard let quantity = (samples?.first as? HKQuantitySample)?.quantity else {
                        return nil
                    }
                    guard quantity.is(compatibleWith: unit) else {
                        return nil
                    }
                    return quantity.doubleValue(for: unit)
                }()
                continuation.resume(returning: value)
            }
            healthStore.execute(query)
        }
    }

    /// Formats a Date as "HH:mm" in the current locale's timezone.
    private func formatTime(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm"
        return formatter.string(from: date)
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
