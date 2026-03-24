import HealthKit
import SwiftUI
import UserNotifications

@main
struct TonalCoachApp: App {
    @UIApplicationDelegateAdaptor private var appDelegate: AppDelegate

    @AppStorage("hasCompletedOnboarding") private var hasCompletedOnboarding = false
    @AppStorage("isGuestMode") private var isGuestMode = false
    @State private var convexManager = ConvexManager()
    @State private var notificationManager = NotificationManager()
    @State private var healthKitManager = HealthKitManager()

    private var authManager: AuthManager { AuthManager.shared }

    var body: some Scene {
        WindowGroup {
            Group {
                if authManager.isLoading {
                    splashView
                } else if authManager.isAuthenticated || isGuestMode {
                    if hasCompletedOnboarding {
                        ContentView()
                    } else {
                        OnboardingView()
                    }
                } else {
                    NavigationStack {
                        LoginView()
                    }
                }
            }
            .environment(convexManager)
            .environment(\.authManager, authManager)
            .environment(\.notificationManager, notificationManager)
            .environment(\.healthKitManager, healthKitManager)
            .preferredColorScheme(.dark)
            .onOpenURL { url in
                handleDeepLink(url: url)
            }
            .task {
                // Init auth manager with convex reference and restore session first
                authManager.setConvexManager(convexManager)
                await authManager.restoreSession()

                // Notification setup (non-blocking for auth)
                appDelegate.notificationManager = notificationManager
                notificationManager.convexManager = convexManager
                await notificationManager.checkAuthorizationStatus()
                notificationManager.registerNotificationCategories()
            }
        }
    }

    // MARK: - Splash View

    private var splashView: some View {
        ZStack {
            Theme.Colors.background
                .ignoresSafeArea()

            Text("tonal.coach")
                .font(.system(size: 36, weight: .bold, design: .default))
                .foregroundStyle(Theme.Colors.primary)
        }
    }

    // MARK: - Deep Links

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
