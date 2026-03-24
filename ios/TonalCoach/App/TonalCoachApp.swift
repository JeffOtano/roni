import HealthKit
import SwiftUI
import UserNotifications

@main
struct TonalCoachApp: App {
    @UIApplicationDelegateAdaptor private var appDelegate: AppDelegate

    @AppStorage("hasCompletedOnboarding") private var hasCompletedOnboarding = false
    @State private var convexManager = ConvexManager()
    @State private var notificationManager = NotificationManager()
    @State private var healthKitManager = HealthKitManager()

    var body: some Scene {
        WindowGroup {
            Group {
                if hasCompletedOnboarding {
                    ContentView()
                } else {
                    OnboardingView()
                }
            }
            .environment(convexManager)
            .environment(\.notificationManager, notificationManager)
            .environment(\.healthKitManager, healthKitManager)
            .preferredColorScheme(.dark)
            .onOpenURL { url in
                handleDeepLink(url: url)
            }
            .task {
                appDelegate.notificationManager = notificationManager
                notificationManager.convexManager = convexManager
                await notificationManager.checkAuthorizationStatus()
                notificationManager.registerNotificationCategories()
            }
        }
    }

    private func handleDeepLink(url: URL) {
        let link = TonalDeepLink(url: url)

        switch link {
        case .tonalWorkout:
            // Re-open in the Tonal app for native handling
            TonalDeepLink.openInTonal(url: url.absoluteString)

        case .workout:
            // TODO: Navigate to workout detail view in Phase 1 Library build
            break

        case .unknown:
            break
        }
    }
}

// MARK: - App Delegate

/// Bridges UIKit push notification callbacks to `NotificationManager`.
final class AppDelegate: NSObject, UIApplicationDelegate {
    /// Set by TonalCoachApp on launch so callbacks can forward tokens.
    var notificationManager: NotificationManager?

    private let notificationDelegate = NotificationDelegate()

    func application(
        _: UIApplication,
        didFinishLaunchingWithOptions _: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = notificationDelegate
        return true
    }

    func application(_: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        notificationManager?.handleDeviceToken(deviceToken)

        Task {
            try? await notificationManager?.syncTokenWithBackend()
        }
    }

    func application(_: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        notificationManager?.handleRegistrationError(error)
    }
}
