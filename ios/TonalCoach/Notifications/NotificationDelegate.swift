import UserNotifications

/// Handles foreground notification presentation and action responses.
///
/// Set as `UNUserNotificationCenter.current().delegate` at app launch to ensure
/// notifications display even when the app is in the foreground.
final class NotificationDelegate: NSObject, UNUserNotificationCenterDelegate {

    // MARK: - Foreground Presentation

    /// Show banner, sound, and badge even when the app is in the foreground.
    func userNotificationCenter(
        _: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        [.banner, .sound, .badge]
    }

    // MARK: - Action Response

    /// Routes the user's tap or action button press to the appropriate handler.
    func userNotificationCenter(
        _: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse
    ) async {
        let actionId = response.actionIdentifier
        let userInfo = response.notification.request.content.userInfo
        let category = response.notification.request.content.categoryIdentifier

        // Default tap (no specific action button) opens the app.
        guard actionId != UNNotificationDefaultActionIdentifier else {
            handleDefaultTap(category: category, userInfo: userInfo)
            return
        }

        // Dismiss action - nothing to do.
        guard actionId != UNNotificationDismissActionIdentifier else { return }

        switch category {
        case NotificationCategory.workoutReminder:
            handleWorkoutReminderAction(actionId, workoutSlug: userInfo["workoutSlug"] as? String)

        case NotificationCategory.checkIn:
            handleCheckInAction(actionId)

        case NotificationCategory.weeklyRecap:
            handleWeeklyRecapAction(actionId)

        case NotificationCategory.coachMessage:
            handleCoachMessageAction(actionId, threadId: userInfo["threadId"] as? String)

        default:
            break
        }
    }

    // MARK: - Default Tap

    /// Handles a plain tap on the notification (no action button).
    /// Posts a notification so the active view can navigate.
    private func handleDefaultTap(category: String, userInfo: [AnyHashable: Any]) {
        NotificationCenter.default.post(
            name: .notificationTapped,
            object: nil,
            userInfo: [
                "category": category,
                "payload": userInfo,
            ]
        )
    }

    // MARK: - Workout Reminder Actions

    private func handleWorkoutReminderAction(_ action: String, workoutSlug: String?) {
        switch action {
        case NotificationAction.startWorkout:
            // Navigate to the workout or open Tonal deep link.
            NotificationCenter.default.post(
                name: .notificationTapped,
                object: nil,
                userInfo: [
                    "category": NotificationCategory.workoutReminder,
                    "action": "start",
                    "workoutSlug": workoutSlug as Any,
                ]
            )

        case NotificationAction.snooze30:
            // Schedule a local notification 30 minutes from now.
            scheduleSnoozeReminder(minutes: 30, workoutSlug: workoutSlug)

        case NotificationAction.skipToday:
            // TODO: Mark today's session as skipped via Convex mutation.
            break

        default:
            break
        }
    }

    // MARK: - Check-In Actions

    private func handleCheckInAction(_ action: String) {
        let response: String
        switch action {
        case NotificationAction.checkInGreat: response = "great"
        case NotificationAction.checkInOkay: response = "okay"
        case NotificationAction.checkInTough: response = "tough"
        default: return
        }

        NotificationCenter.default.post(
            name: .notificationTapped,
            object: nil,
            userInfo: [
                "category": NotificationCategory.checkIn,
                "action": "respond",
                "response": response,
            ]
        )
    }

    // MARK: - Weekly Recap Actions

    private func handleWeeklyRecapAction(_ action: String) {
        guard action == NotificationAction.viewSummary else { return }

        NotificationCenter.default.post(
            name: .notificationTapped,
            object: nil,
            userInfo: [
                "category": NotificationCategory.weeklyRecap,
                "action": "viewSummary",
            ]
        )
    }

    // MARK: - Coach Message Actions

    private func handleCoachMessageAction(_ action: String, threadId: String?) {
        guard action == NotificationAction.viewCoachMessage else { return }

        NotificationCenter.default.post(
            name: .notificationTapped,
            object: nil,
            userInfo: [
                "category": NotificationCategory.coachMessage,
                "action": "view",
                "threadId": threadId as Any,
            ]
        )
    }

    // MARK: - Helpers

    /// Schedules a local notification as a snooze reminder.
    private func scheduleSnoozeReminder(minutes: Int, workoutSlug: String?) {
        let content = UNMutableNotificationContent()
        content.title = "Time to Train!"
        content.body = "Your snoozed workout reminder is up."
        content.sound = .default
        content.categoryIdentifier = NotificationCategory.workoutReminder
        if let slug = workoutSlug {
            content.userInfo["workoutSlug"] = slug
        }

        let trigger = UNTimeIntervalNotificationTrigger(
            timeInterval: TimeInterval(minutes * 60),
            repeats: false
        )

        let request = UNNotificationRequest(
            identifier: "snooze_\(UUID().uuidString)",
            content: content,
            trigger: trigger
        )

        UNUserNotificationCenter.current().add(request)
    }
}

// MARK: - Notification Name

extension Notification.Name {
    /// Posted when the user taps a push notification or one of its action buttons.
    /// `userInfo` contains `category`, `action`, and payload-specific keys.
    static let notificationTapped = Notification.Name("notificationTapped")
}
