import SwiftUI
import UIKit
import UserNotifications

/// User-facing controls for notification preferences.
///
/// Embedded in the Profile tab. Stores preferences locally via `UserDefaults`
/// since these are device-specific settings (not synced to Convex).
struct NotificationSettingsView: View {
    @Environment(\.notificationManager) private var notificationManager

    @State private var preferences = NotificationPreferences.load()
    @State private var showingTestConfirmation = false

    var body: some View {
        List {
            permissionStatusSection
            workoutRemindersSection
            weeklyRecapSection
            coachMessagesSection
            checkInsSection
            debugSection
        }
        .scrollContentBackground(.hidden)
        .background(Theme.Colors.background)
        .listStyle(.insetGrouped)
        .navigationTitle("Notifications")
        .onChange(of: preferences) { _, newValue in
            newValue.save()
        }
        .task {
            await notificationManager.checkAuthorizationStatus()
        }
    }

    // MARK: - Sections

    private var permissionStatusSection: some View {
        Section {
            switch notificationManager.authorizationStatus {
            case .denied:
                HStack(spacing: Theme.Spacing.md) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundStyle(Theme.Colors.warning)

                    VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
                        Text("Notifications Disabled")
                            .font(Theme.Typography.calloutMedium)
                            .foregroundStyle(Theme.Colors.foreground)

                        Text("Enable in iOS Settings to receive reminders.")
                            .font(Theme.Typography.caption)
                            .foregroundStyle(Theme.Colors.mutedForeground)
                    }

                    Spacer()

                    Button("Open Settings") {
                        openSystemSettings()
                    }
                    .font(Theme.Typography.caption)
                    .foregroundStyle(Theme.Colors.primary)
                }

            case .authorized, .provisional, .ephemeral:
                HStack(spacing: Theme.Spacing.md) {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(Theme.Colors.success)

                    Text("Notifications Enabled")
                        .font(Theme.Typography.calloutMedium)
                        .foregroundStyle(Theme.Colors.foreground)
                }

            case .notDetermined:
                HStack(spacing: Theme.Spacing.md) {
                    Image(systemName: "questionmark.circle.fill")
                        .foregroundStyle(Theme.Colors.mutedForeground)

                    Text("Permission Not Requested")
                        .font(Theme.Typography.calloutMedium)
                        .foregroundStyle(Theme.Colors.foreground)

                    Spacer()

                    Button("Enable") {
                        Task {
                            _ = try? await notificationManager.requestAuthorization()
                            if notificationManager.isAuthorized {
                                await MainActor.run {
                                    notificationManager.registerForRemoteNotifications()
                                }
                            }
                        }
                    }
                    .font(Theme.Typography.caption)
                    .foregroundStyle(Theme.Colors.primary)
                }

            @unknown default:
                EmptyView()
            }
        }
        .listRowBackground(Theme.Colors.card)
    }

    private var workoutRemindersSection: some View {
        Section {
            Toggle(isOn: $preferences.workoutRemindersEnabled) {
                Label("Workout Reminders", systemImage: "dumbbell.fill")
                    .font(Theme.Typography.callout)
                    .foregroundStyle(Theme.Colors.foreground)
            }
            .tint(Theme.Colors.primary)

            if preferences.workoutRemindersEnabled {
                DatePicker(
                    "Reminder Time",
                    selection: $preferences.reminderTime,
                    displayedComponents: .hourAndMinute
                )
                .font(Theme.Typography.callout)
                .foregroundStyle(Theme.Colors.foreground)
            }
        } header: {
            Text("Workout Reminders")
                .font(Theme.Typography.caption)
                .foregroundStyle(Theme.Colors.mutedForeground)
        } footer: {
            Text("Get reminded to train at your preferred time on workout days.")
                .font(Theme.Typography.caption)
                .foregroundStyle(Theme.Colors.tertiaryForeground)
        }
        .listRowBackground(Theme.Colors.card)
    }

    private var weeklyRecapSection: some View {
        Section {
            Toggle(isOn: $preferences.weeklyRecapEnabled) {
                Label("Weekly Recap", systemImage: "chart.bar.fill")
                    .font(Theme.Typography.callout)
                    .foregroundStyle(Theme.Colors.foreground)
            }
            .tint(Theme.Colors.primary)

            if preferences.weeklyRecapEnabled {
                Picker("Day", selection: $preferences.weeklyRecapDay) {
                    Text("Monday").tag(1)
                    Text("Tuesday").tag(2)
                    Text("Wednesday").tag(3)
                    Text("Thursday").tag(4)
                    Text("Friday").tag(5)
                    Text("Saturday").tag(6)
                    Text("Sunday").tag(7)
                }
                .font(Theme.Typography.callout)
                .foregroundStyle(Theme.Colors.foreground)
            }
        } header: {
            Text("Weekly Recap")
                .font(Theme.Typography.caption)
                .foregroundStyle(Theme.Colors.mutedForeground)
        } footer: {
            Text("Receive a summary of your training week.")
                .font(Theme.Typography.caption)
                .foregroundStyle(Theme.Colors.tertiaryForeground)
        }
        .listRowBackground(Theme.Colors.card)
    }

    private var coachMessagesSection: some View {
        Section {
            Toggle(isOn: $preferences.coachMessagesEnabled) {
                Label("Coach Messages", systemImage: "brain.head.profile")
                    .font(Theme.Typography.callout)
                    .foregroundStyle(Theme.Colors.foreground)
            }
            .tint(Theme.Colors.primary)
        } header: {
            Text("AI Coach")
                .font(Theme.Typography.caption)
                .foregroundStyle(Theme.Colors.mutedForeground)
        } footer: {
            Text("Tips and suggestions from your AI coach.")
                .font(Theme.Typography.caption)
                .foregroundStyle(Theme.Colors.tertiaryForeground)
        }
        .listRowBackground(Theme.Colors.card)
    }

    private var checkInsSection: some View {
        Section {
            Toggle(isOn: $preferences.checkInsEnabled) {
                Label("Post-Workout Check-Ins", systemImage: "checkmark.message.fill")
                    .font(Theme.Typography.callout)
                    .foregroundStyle(Theme.Colors.foreground)
            }
            .tint(Theme.Colors.primary)
        } header: {
            Text("Check-Ins")
                .font(Theme.Typography.caption)
                .foregroundStyle(Theme.Colors.mutedForeground)
        } footer: {
            Text("Quick feedback prompts after your workouts.")
                .font(Theme.Typography.caption)
                .foregroundStyle(Theme.Colors.tertiaryForeground)
        }
        .listRowBackground(Theme.Colors.card)
    }

    private var debugSection: some View {
        Section {
            Button {
                sendTestNotification()
            } label: {
                Label("Send Test Notification", systemImage: "bell.badge")
                    .font(Theme.Typography.callout)
                    .foregroundStyle(Theme.Colors.primary)
            }

            if let token = notificationManager.deviceToken {
                VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
                    Text("Device Token")
                        .font(Theme.Typography.caption)
                        .foregroundStyle(Theme.Colors.mutedForeground)

                    Text(token)
                        .font(Theme.Typography.monoText)
                        .foregroundStyle(Theme.Colors.tertiaryForeground)
                        .lineLimit(2)
                        .truncationMode(.middle)
                        .textSelection(.enabled)
                }
            }
        } header: {
            Text("Debug")
                .font(Theme.Typography.caption)
                .foregroundStyle(Theme.Colors.mutedForeground)
        }
        .listRowBackground(Theme.Colors.card)
    }

    // MARK: - Actions

    private func openSystemSettings() {
        guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
        UIApplication.shared.open(url)
    }

    private func sendTestNotification() {
        let content = UNMutableNotificationContent()
        content.title = "Test Notification"
        content.body = "Push notifications are working! Your coach is ready."
        content.sound = .default
        content.categoryIdentifier = NotificationCategory.coachMessage

        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 2, repeats: false)

        let request = UNNotificationRequest(
            identifier: "test_\(UUID().uuidString)",
            content: content,
            trigger: trigger
        )

        UNUserNotificationCenter.current().add(request)
    }
}

// MARK: - Notification Preferences

/// Local notification preference storage backed by UserDefaults.
///
/// These are device-specific settings and do not sync to Convex.
struct NotificationPreferences: Equatable {
    var workoutRemindersEnabled: Bool = true
    var reminderTime: Date = Self.defaultReminderTime
    var weeklyRecapEnabled: Bool = true
    var weeklyRecapDay: Int = 1 // Monday
    var coachMessagesEnabled: Bool = true
    var checkInsEnabled: Bool = true

    // MARK: - Defaults

    /// Default reminder time: 6:00 PM today.
    private static var defaultReminderTime: Date {
        var components = DateComponents()
        components.hour = 18
        components.minute = 0
        return Calendar.current.date(from: components) ?? .now
    }

    // MARK: - Persistence Keys

    private enum Keys {
        static let workoutReminders = "notification_workoutReminders"
        static let reminderTime = "notification_reminderTime"
        static let weeklyRecap = "notification_weeklyRecap"
        static let weeklyRecapDay = "notification_weeklyRecapDay"
        static let coachMessages = "notification_coachMessages"
        static let checkIns = "notification_checkIns"
    }

    // MARK: - Save / Load

    func save() {
        let defaults = UserDefaults.standard
        defaults.set(workoutRemindersEnabled, forKey: Keys.workoutReminders)
        defaults.set(reminderTime.timeIntervalSince1970, forKey: Keys.reminderTime)
        defaults.set(weeklyRecapEnabled, forKey: Keys.weeklyRecap)
        defaults.set(weeklyRecapDay, forKey: Keys.weeklyRecapDay)
        defaults.set(coachMessagesEnabled, forKey: Keys.coachMessages)
        defaults.set(checkInsEnabled, forKey: Keys.checkIns)
    }

    static func load() -> NotificationPreferences {
        let defaults = UserDefaults.standard

        // Return defaults if nothing has been saved yet.
        guard defaults.object(forKey: Keys.workoutReminders) != nil else {
            return NotificationPreferences()
        }

        let reminderInterval = defaults.double(forKey: Keys.reminderTime)
        let reminderDate = reminderInterval > 0
            ? Date(timeIntervalSince1970: reminderInterval)
            : defaultReminderTime

        return NotificationPreferences(
            workoutRemindersEnabled: defaults.bool(forKey: Keys.workoutReminders),
            reminderTime: reminderDate,
            weeklyRecapEnabled: defaults.bool(forKey: Keys.weeklyRecap),
            weeklyRecapDay: {
                let day = defaults.integer(forKey: Keys.weeklyRecapDay)
                return (1...7).contains(day) ? day : 1
            }(),
            coachMessagesEnabled: defaults.bool(forKey: Keys.coachMessages),
            checkInsEnabled: defaults.bool(forKey: Keys.checkIns)
        )
    }
}

#Preview {
    NavigationStack {
        NotificationSettingsView()
    }
    .preferredColorScheme(.dark)
}
