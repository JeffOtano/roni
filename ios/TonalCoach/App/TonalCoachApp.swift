import Combine
import ConvexMobile
import HealthKit
import SwiftUI
import UserNotifications

@main
struct TonalCoachApp: App {
    @UIApplicationDelegateAdaptor private var appDelegate: AppDelegate

    @AppStorage("isGuestMode") private var isGuestMode = false
    @AppStorage("hasSeenWelcome") private var hasSeenWelcome = false
    @State private var convexManager = ConvexManager()
    @State private var notificationManager = NotificationManager()
    @State private var healthKitManager = HealthKitManager()
    @State private var healthSyncManager = HealthSyncManager()
    @Environment(\.scenePhase) private var scenePhase

    /// Tracks onboarding status reactively from the `users:getMe` query.
    @State private var onboardingCompleted: Bool?
    @State private var userInfoCancellable: AnyCancellable?

    /// Tab to navigate to after onboarding completes.
    @State private var initialTab: AppTab = .chat

    @State private var isLaunched = false

    private var authManager: AuthManager { AuthManager.shared }

    var body: some Scene {
        WindowGroup {
            Group {
                if isLaunched {
                    if !hasSeenWelcome {
                        WelcomeCarouselView()
                    } else if authManager.isLoading {
                        splashView
                    } else if isGuestMode {
                        ContentView(initialTab: .library)
                    } else if authManager.isAuthenticated {
                        if onboardingCompleted == true {
                            ContentView(initialTab: initialTab)
                        } else if onboardingCompleted == false {
                            TrainingOnboardingFlow(onComplete: { tab in
                                initialTab = tab
                                // onboardingCompleted will flip to true reactively
                                // via the users:getMe subscription after the mutation
                            })
                        } else {
                            // Still loading user info
                            splashView
                                .onAppear {
                                    // Re-subscribe after sign-in since the initial
                                    // subscription may have failed when unauthenticated
                                    userInfoCancellable = nil
                                    subscribeToUserInfo()
                                }
                        }
                    } else {
                        NavigationStack {
                            LoginView()
                        }
                    }
                } else {
                    VStack {
                        Image(systemName: "figure.strengthtraining.traditional")
                            .font(.system(size: 48))
                            .foregroundStyle(Theme.Colors.primary)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Theme.Colors.background)
                }
            }
            .onAppear {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                    withAnimation(Animate.smooth) {
                        isLaunched = true
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
            .onChange(of: scenePhase) { _, newPhase in
                switch newPhase {
                case .active:
                    healthSyncManager.syncIfNeeded()
                    healthSyncManager.startPeriodicTimer()
                case .background:
                    healthSyncManager.stopPeriodicTimer()
                default:
                    break
                }
            }
            .task {
                // Pre-initialize haptic generators to reduce first-tap latency
                HapticEngine.warmUp()

                // Init auth manager with convex reference and restore session first
                authManager.setConvexManager(convexManager)
                await authManager.restoreSession()

                // Subscribe to user info for reactive onboarding status
                subscribeToUserInfo()

                // Notification setup (non-blocking for auth)
                appDelegate.notificationManager = notificationManager
                notificationManager.convexManager = convexManager
                await notificationManager.checkAuthorizationStatus()
                notificationManager.registerNotificationCategories()

                // Health sync setup
                healthSyncManager.configure(convex: convexManager, health: healthKitManager)
                if healthKitManager.isAuthorized {
                    healthSyncManager.startSync()
                }
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

    // MARK: - User Info Subscription

    private func subscribeToUserInfo() {
        guard userInfoCancellable == nil else { return }
        userInfoCancellable = convexManager.client
            .subscribe(to: "users:getMe", yielding: UserInfo.self)
            .receive(on: DispatchQueue.main)
            .sink(
                receiveCompletion: { _ in
                    // If query fails (e.g. unauthenticated), treat as not completed
                    if onboardingCompleted == nil {
                        onboardingCompleted = false
                    }
                },
                receiveValue: { info in
                    onboardingCompleted = info.onboardingCompleted
                }
            )
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

    func application(
        _: UIApplication,
        supportedInterfaceOrientationsFor _: UIWindow?
    ) -> UIInterfaceOrientationMask {
        if UIDevice.current.userInterfaceIdiom == .pad {
            return .all
        }
        return .portrait
    }
}
