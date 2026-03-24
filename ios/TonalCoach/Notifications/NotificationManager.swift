import ConvexMobile
import UIKit
import UserNotifications

/// Manages push notification authorization, device token registration, and category setup.
///
/// Uses `@Observable` (iOS 17+) so SwiftUI views react to permission state changes.
/// Inject via `.environment(notificationManager)`.
@Observable
final class NotificationManager: NSObject {
    // MARK: - State

    var isAuthorized = false
    var authorizationStatus: UNAuthorizationStatus = .notDetermined
    var deviceToken: String?

    /// Reference to ConvexManager for backend sync. Set by TonalCoachApp on launch.
    var convexManager: ConvexManager?

    // MARK: - Private

    private let center = UNUserNotificationCenter.current()

    // MARK: - Permission

    /// Requests notification authorization for alerts, sounds, and badges.
    /// Returns `true` if the user granted permission.
    @discardableResult
    func requestAuthorization() async throws -> Bool {
        let granted = try await center.requestAuthorization(options: [.alert, .badge, .sound])
        await checkAuthorizationStatus()
        return granted
    }

    /// Refreshes the cached authorization status from the notification center.
    func checkAuthorizationStatus() async {
        let settings = await center.notificationSettings()
        authorizationStatus = settings.authorizationStatus
        isAuthorized = settings.authorizationStatus == .authorized
            || settings.authorizationStatus == .provisional
            || settings.authorizationStatus == .ephemeral
    }

    // MARK: - Registration

    /// Asks iOS to register this device for remote (push) notifications.
    /// Must be called on the main thread.
    @MainActor
    func registerForRemoteNotifications() {
        UIApplication.shared.registerForRemoteNotifications()
    }

    /// Converts the raw APNs device token to a hex string and stores it.
    func handleDeviceToken(_ token: Data) {
        let hex = token.map { String(format: "%02x", $0) }.joined()
        deviceToken = hex
    }

    /// Logs the APNs registration error. The token remains `nil`.
    func handleRegistrationError(_ error: Error) {
        print("[NotificationManager] Registration failed: \(error.localizedDescription)")
    }

    // MARK: - Token Sync

    /// Sends the current device token to the Convex backend.
    /// Call after both authentication and token registration succeed.
    func syncTokenWithBackend() async throws {
        guard let token = deviceToken else { return }

        let deviceName = await UIDevice.current.name

        guard let convexManager else { return }
        try await convexManager.mutation(
            "notifications/pushTokens:registerToken",
            with: [
                "token": token,
                "platform": "ios",
                "deviceName": deviceName,
            ]
        )
    }

    // MARK: - Categories

    /// Registers UNNotificationCategory definitions so iOS can display custom actions.
    func registerNotificationCategories() {
        let categories: Set<UNNotificationCategory> = [
            workoutReminderCategory,
            weeklyRecapCategory,
            checkInCategory,
            coachMessageCategory,
        ]
        center.setNotificationCategories(categories)
    }

    // MARK: - Category Definitions

    private var workoutReminderCategory: UNNotificationCategory {
        let start = UNNotificationAction(
            identifier: NotificationAction.startWorkout,
            title: "Start Workout",
            options: .foreground
        )
        let snooze = UNNotificationAction(
            identifier: NotificationAction.snooze30,
            title: "Snooze 30min",
            options: []
        )
        let skip = UNNotificationAction(
            identifier: NotificationAction.skipToday,
            title: "Skip Today",
            options: .destructive
        )
        return UNNotificationCategory(
            identifier: NotificationCategory.workoutReminder,
            actions: [start, snooze, skip],
            intentIdentifiers: []
        )
    }

    private var weeklyRecapCategory: UNNotificationCategory {
        let view = UNNotificationAction(
            identifier: NotificationAction.viewSummary,
            title: "View Summary",
            options: .foreground
        )
        return UNNotificationCategory(
            identifier: NotificationCategory.weeklyRecap,
            actions: [view],
            intentIdentifiers: []
        )
    }

    private var checkInCategory: UNNotificationCategory {
        let great = UNNotificationAction(
            identifier: NotificationAction.checkInGreat,
            title: "Great",
            options: []
        )
        let okay = UNNotificationAction(
            identifier: NotificationAction.checkInOkay,
            title: "Okay",
            options: []
        )
        let tough = UNNotificationAction(
            identifier: NotificationAction.checkInTough,
            title: "Tough",
            options: []
        )
        return UNNotificationCategory(
            identifier: NotificationCategory.checkIn,
            actions: [great, okay, tough],
            intentIdentifiers: []
        )
    }

    private var coachMessageCategory: UNNotificationCategory {
        let view = UNNotificationAction(
            identifier: NotificationAction.viewCoachMessage,
            title: "View",
            options: .foreground
        )
        return UNNotificationCategory(
            identifier: NotificationCategory.coachMessage,
            actions: [view],
            intentIdentifiers: []
        )
    }
}

// MARK: - Constants

/// Notification category identifiers. Sent in the APNs payload `category` field.
enum NotificationCategory {
    static let workoutReminder = "workout_reminder"
    static let weeklyRecap = "weekly_recap"
    static let checkIn = "check_in"
    static let coachMessage = "coach_message"
}

/// Notification action identifiers. Returned by `UNNotificationResponse.actionIdentifier`.
enum NotificationAction {
    static let startWorkout = "START_WORKOUT"
    static let snooze30 = "SNOOZE_30"
    static let skipToday = "SKIP_TODAY"
    static let viewSummary = "VIEW_SUMMARY"
    static let checkInGreat = "CHECK_IN_GREAT"
    static let checkInOkay = "CHECK_IN_OKAY"
    static let checkInTough = "CHECK_IN_TOUGH"
    static let viewCoachMessage = "VIEW_COACH_MESSAGE"
}

// MARK: - SwiftUI Environment

private struct NotificationManagerKey: EnvironmentKey {
    static let defaultValue = NotificationManager()
}

extension EnvironmentValues {
    var notificationManager: NotificationManager {
        get { self[NotificationManagerKey.self] }
        set { self[NotificationManagerKey.self] = newValue }
    }
}
