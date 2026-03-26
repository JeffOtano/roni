import ConvexMobile
import HealthKit
import SwiftUI

// MARK: - HealthSyncManager

/// Orchestrates syncing HealthKit data to Convex on 4 triggers:
/// app open, foreground return, periodic 15-min timer, and HK background delivery.
///
/// Uses `@Observable` (iOS 17+). Call `configure(convex:health:)` once at app
/// launch before calling `startSync()`.
@Observable
final class HealthSyncManager {
    // MARK: - State

    private(set) var lastSyncTime: Date?
    private(set) var isSyncing = false

    // MARK: - Private

    private var convexManager: ConvexManager?
    private var healthKitManager: HealthKitManager?
    private var periodicTimer: Timer?
    private let healthStore = HKHealthStore()
    private var observerQueries: [HKObserverQuery] = []

    // MARK: - Setup

    /// Inject dependencies. Must be called before `startSync()`.
    func configure(convex: ConvexManager, health: HealthKitManager) {
        convexManager = convex
        healthKitManager = health
    }

    // MARK: - Start (called on app open)

    /// Triggers a full sync immediately, registers background delivery observers,
    /// and starts the 15-minute periodic timer.
    func startSync() {
        Task { await performFullSync() }
        registerBackgroundDelivery()
        startPeriodicTimer()
    }

    // MARK: - Debounced Sync (foreground return)

    /// Runs a full sync only if it has been more than 60 seconds since the last one.
    func syncIfNeeded() {
        guard let last = lastSyncTime else {
            Task { await performFullSync() }
            return
        }
        if Date().timeIntervalSince(last) > 60 {
            Task { await performFullSync() }
        }
    }

    // MARK: - Full Sync

    /// Fetches all health data types in parallel and syncs the snapshot to Convex.
    /// Silent on failure - the AI coach works fine without health data.
    func performFullSync() async {
        guard !isSyncing, let health = healthKitManager, let convex = convexManager else { return }
        isSyncing = true
        defer {
            isSyncing = false
            lastSyncTime = Date()
        }

        do {
            let snapshot = try await buildSnapshot(health: health)
            try await syncToConvex(snapshot: snapshot, convex: convex)
        } catch {
            print("[HealthSync] Full sync failed: \(error.localizedDescription)")
        }
    }

    // MARK: - Lightweight Sync (periodic, activity-only)

    /// Syncs only fast-changing activity metrics: steps, energy, exercise, flights.
    /// Used for the 15-minute periodic timer to avoid unnecessary heavy queries.
    private func performLightweightSync() async {
        guard !isSyncing, let health = healthKitManager, let convex = convexManager else { return }
        isSyncing = true
        defer {
            isSyncing = false
            lastSyncTime = Date()
        }

        do {
            let today = dateString()
            let steps = try? await health.fetchTodayCumulativeSum(for: .stepCount, unit: .count())
            let energy = try? await health.fetchTodayCumulativeSum(
                for: .activeEnergyBurned,
                unit: .kilocalorie()
            )
            let exercise = try? await health.fetchTodayCumulativeSum(
                for: .appleExerciseTime,
                unit: .minute()
            )
            let flights = try? await health.fetchTodayCumulativeSum(
                for: .flightsClimbed,
                unit: .count()
            )

            var args: [String: ConvexEncodable?] = [
                "date": today,
                "syncedAt": Double(Date().timeIntervalSince1970 * 1000),
            ]
            if let steps { args["steps"] = steps }
            if let energy { args["activeEnergyBurned"] = energy }
            if let exercise { args["exerciseMinutes"] = exercise }
            if let flights { args["flightsClimbed"] = flights }

            try await convex.mutation("health:syncSnapshot", with: args)
        } catch {
            print("[HealthSync] Lightweight sync failed: \(error.localizedDescription)")
        }
    }

    // MARK: - Build Snapshot

    /// Fetches all health data types in parallel and assembles a Convex-ready
    /// args dictionary. Individual query failures are silently ignored via `try?`.
    private func buildSnapshot(health: HealthKitManager) async throws -> [String: ConvexEncodable?] {
        let today = dateString()

        async let sleep = health.fetchLastNightSleep()
        async let hrv = health.fetchLatestQuantity(
            for: .heartRateVariabilitySDNN,
            unit: .secondUnit(with: .milli)
        )
        async let rhr = health.fetchLatestQuantity(
            for: .restingHeartRate,
            unit: HKUnit.count().unitDivided(by: .minute())
        )
        async let vo2 = health.fetchLatestQuantity(
            for: .vo2Max,
            unit: HKUnit(from: "ml/kg*min")
        )
        async let hrRecovery = health.fetchLatestQuantity(
            for: .heartRateRecoveryOneMinute,
            unit: HKUnit.count().unitDivided(by: .minute())
        )
        async let spo2 = health.fetchLatestQuantity(for: .oxygenSaturation, unit: .percent())
        async let steps = health.fetchTodayCumulativeSum(for: .stepCount, unit: .count())
        async let energy = health.fetchTodayCumulativeSum(
            for: .activeEnergyBurned,
            unit: .kilocalorie()
        )
        async let exercise = health.fetchTodayCumulativeSum(
            for: .appleExerciseTime,
            unit: .minute()
        )
        async let flights = health.fetchTodayCumulativeSum(for: .flightsClimbed, unit: .count())
        async let bodyMass = health.fetchLatestQuantity(
            for: .bodyMass,
            unit: .gramUnit(with: .kilo)
        )
        async let bodyFat = health.fetchLatestQuantity(for: .bodyFatPercentage, unit: .percent())
        async let leanMass = health.fetchLatestQuantity(
            for: .leanBodyMass,
            unit: .gramUnit(with: .kilo)
        )
        async let calories = health.fetchTodayCumulativeSum(
            for: .dietaryEnergyConsumed,
            unit: .kilocalorie()
        )
        async let protein = health.fetchTodayCumulativeSum(
            for: .dietaryProtein,
            unit: .gram()
        )
        async let respRate = health.fetchLatestQuantity(
            for: .respiratoryRate,
            unit: HKUnit.count().unitDivided(by: .minute())
        )
        // Await all - individual failures are silenced so one missing
        // permission doesn't block the entire sync.
        let sleepData = try? await sleep
        let hrvVal = try? await hrv
        let rhrVal = try? await rhr
        let vo2Val = try? await vo2
        let hrRecoveryVal = try? await hrRecovery
        let spo2Val = try? await spo2
        let stepsVal = try? await steps
        let energyVal = try? await energy
        let exerciseVal = try? await exercise
        let flightsVal = try? await flights
        let bodyMassVal = try? await bodyMass
        let bodyFatVal = try? await bodyFat
        let leanMassVal = try? await leanMass
        let caloriesVal = try? await calories
        let proteinVal = try? await protein
        let respRateVal = try? await respRate

        // workoutEffortScore requires iOS 18+
        var effortVal: Double?
        if #available(iOS 18.0, *) {
            effortVal = try? await health.fetchLatestQuantity(
                for: .workoutEffortScore,
                unit: .count()
            )
        }

        var args: [String: ConvexEncodable?] = [
            "date": today,
            "syncedAt": Double(Date().timeIntervalSince1970 * 1000),
        ]

        // Sleep
        if let s = sleepData {
            args["sleepDurationMinutes"] = s.durationMinutes
            if let v = s.deepMinutes { args["sleepDeepMinutes"] = v }
            if let v = s.remMinutes { args["sleepRemMinutes"] = v }
            if let v = s.coreMinutes { args["sleepCoreMinutes"] = v }
            if let v = s.awakeMinutes { args["sleepAwakeMinutes"] = v }
            if let v = s.startTime { args["sleepStartTime"] = v }
            if let v = s.endTime { args["sleepEndTime"] = v }
        }

        // Heart & Recovery
        if let v = rhrVal { args["restingHeartRate"] = v }
        if let v = hrvVal { args["hrvSDNN"] = v }
        if let v = vo2Val { args["vo2Max"] = v }
        if let v = hrRecoveryVal { args["heartRateRecovery"] = v }
        if let v = spo2Val { args["oxygenSaturation"] = v }

        // Activity - only include non-zero values to avoid sending stale zeros
        if let v = stepsVal, v > 0 { args["steps"] = v }
        if let v = energyVal, v > 0 { args["activeEnergyBurned"] = v }
        if let v = exerciseVal, v > 0 { args["exerciseMinutes"] = v }
        if let v = flightsVal, v > 0 { args["flightsClimbed"] = v }

        // Body
        if let v = bodyMassVal { args["bodyMass"] = v }
        if let v = bodyFatVal { args["bodyFatPercentage"] = v }
        if let v = leanMassVal { args["leanBodyMass"] = v }

        // Nutrition - only include non-zero values
        if let v = caloriesVal, v > 0 { args["dietaryCalories"] = v }
        if let v = proteinVal, v > 0 { args["dietaryProteinGrams"] = v }

        // Respiratory & Effort
        if let v = respRateVal { args["respiratoryRate"] = v }
        if let v = effortVal { args["workoutEffortScore"] = v }

        return args
    }

    // MARK: - Sync to Convex

    private func syncToConvex(
        snapshot: [String: ConvexEncodable?],
        convex: ConvexManager
    ) async throws {
        try await convex.mutation("health:syncSnapshot", with: snapshot)
    }

    // MARK: - Periodic Timer

    /// Starts a repeating 15-minute timer that performs a lightweight sync.
    func startPeriodicTimer() {
        stopPeriodicTimer()
        periodicTimer = Timer.scheduledTimer(withTimeInterval: 900, repeats: true) { [weak self] _ in
            Task { await self?.performLightweightSync() }
        }
    }

    /// Invalidates the periodic timer without stopping background delivery observers.
    func stopPeriodicTimer() {
        periodicTimer?.invalidate()
        periodicTimer = nil
    }

    // MARK: - Background Delivery

    /// Registers HKObserverQuery for sleep, workouts, HRV, resting HR, body mass,
    /// and VO2 Max. When any of these types update in HealthKit (even while the
    /// app is backgrounded), the observer fires a full sync.
    private func registerBackgroundDelivery() {
        var typesAndFrequency: [(HKSampleType, HKUpdateFrequency)] = []

        if let sleepType = HKCategoryType.categoryType(forIdentifier: .sleepAnalysis) {
            typesAndFrequency.append((sleepType, .immediate))
        }
        typesAndFrequency.append((HKObjectType.workoutType(), .immediate))
        if let hrvType = HKQuantityType.quantityType(forIdentifier: .heartRateVariabilitySDNN) {
            typesAndFrequency.append((hrvType, .hourly))
        }
        if let rhrType = HKQuantityType.quantityType(forIdentifier: .restingHeartRate) {
            typesAndFrequency.append((rhrType, .hourly))
        }
        if let bodyMassType = HKQuantityType.quantityType(forIdentifier: .bodyMass) {
            typesAndFrequency.append((bodyMassType, .hourly))
        }
        if let vo2Type = HKQuantityType.quantityType(forIdentifier: .vo2Max) {
            typesAndFrequency.append((vo2Type, .hourly))
        }

        for (sampleType, frequency) in typesAndFrequency {
            healthStore.enableBackgroundDelivery(
                for: sampleType,
                frequency: frequency
            ) { _, error in
                if let error {
                    print("[HealthSync] Background delivery registration failed for \(sampleType): \(error)")
                }
            }

            let query = HKObserverQuery(
                sampleType: sampleType,
                predicate: nil
            ) { [weak self] _, completionHandler, error in
                guard error == nil, let self else {
                    completionHandler()
                    return
                }
                Task {
                    await self.performFullSync()
                    completionHandler()
                }
            }
            healthStore.execute(query)
            observerQueries.append(query)
        }
    }

    // MARK: - Cleanup

    /// Stops all background delivery observers and the periodic timer.
    func stopObserving() {
        for query in observerQueries {
            healthStore.stop(query)
        }
        observerQueries.removeAll()
        stopPeriodicTimer()
    }

    // MARK: - Helpers

    private func dateString() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: Date())
    }
}
