import HealthKit
import SwiftUI
import UserNotifications

@main
struct TonalCoachApp: App {
    @UIApplicationDelegateAdaptor private var appDelegate: AppDelegate

    @AppStorage("hasCompletedOnboarding") private var hasCompletedOnboarding = false
    @AppStorage("isGuestMode") private var isGuestMode = false
    @State private var convexManager = ConvexManager()
    @State private var authManager: AuthManager?
    @State private var notificationManager = NotificationManager()
    @State private var healthKitManager = HealthKitManager()

    var body: some Scene {
        WindowGroup {
            Group {
                if let authManager {
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
                } else {
                    splashView
                }
            }
            .environment(convexManager)
            .environment(\.authManager, authManager ?? AuthManager(convexManager: convexManager))
            .environment(\.notificationManager, notificationManager)
            .environment(\.healthKitManager, healthKitManager)
            .preferredColorScheme(.dark)
            .onOpenURL { url in
                handleDeepLink(url: url)
            }
            .task {
                let manager = AuthManager(convexManager: convexManager)
                authManager = manager

                appDelegate.notificationManager = notificationManager
                notificationManager.convexManager = convexManager
                await notificationManager.checkAuthorizationStatus()
                notificationManager.registerNotificationCategories()

                await manager.restoreSession()
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
