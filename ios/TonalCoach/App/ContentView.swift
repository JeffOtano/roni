import Combine
import ConvexMobile
import SwiftUI

enum AppTab: String, CaseIterable {
    case library = "Library"
    case schedule = "Schedule"
    case dashboard = "Dashboard"
    case chat = "Chat"
    case profile = "Profile"

    var icon: String {
        switch self {
        case .library: "dumbbell"
        case .schedule: "calendar"
        case .dashboard: "chart.bar"
        case .chat: "message"
        case .profile: "person"
        }
    }
}

/// Root view with tab-based navigation.
struct ContentView: View {
    @State private var selectedTab: AppTab = .library

    var body: some View {
        TabView(selection: $selectedTab) {
            LibraryHomeView()
                .tabItem {
                    Label(AppTab.library.rawValue, systemImage: AppTab.library.icon)
                }
                .tag(AppTab.library)

            ScheduleView()
                .tabItem {
                    Label(AppTab.schedule.rawValue, systemImage: AppTab.schedule.icon)
                }
                .tag(AppTab.schedule)

            NavigationStack {
                DashboardRouter()
                    .navigationTitle("Dashboard")
                    .navigationBarTitleDisplayMode(.large)
            }
            .tabItem {
                Label(AppTab.dashboard.rawValue, systemImage: AppTab.dashboard.icon)
            }
            .tag(AppTab.dashboard)

            ChatView()
                .tabItem {
                    Label(AppTab.chat.rawValue, systemImage: AppTab.chat.icon)
                }
                .tag(AppTab.chat)

            NavigationStack {
                ProfileView()
            }
            .tabItem {
                Label(AppTab.profile.rawValue, systemImage: AppTab.profile.icon)
            }
            .tag(AppTab.profile)
        }
        .tint(Theme.Colors.primary)
        .onChange(of: selectedTab) { _, _ in
            Theme.Haptics.selection()
        }
    }
}

// MARK: - Dashboard Router

/// Routes between the Tonal dashboard and a connect prompt based on user profile state.
private struct DashboardRouter: View {
    @Environment(ConvexManager.self) private var convex
    @State private var userInfo: UserInfo?
    @State private var isLoaded = false
    @State private var showConnectSheet = false
    @State private var cancellable: AnyCancellable?

    var body: some View {
        Group {
            if !isLoaded {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let info = userInfo, info.hasTonalProfile, !info.tonalTokenExpired {
                TonalDashboardView()
            } else {
                ScrollView {
                    VStack(spacing: Theme.Spacing.lg) {
                        connectPromptCard
                        HealthDashboardView()
                    }
                    .padding(.horizontal, Theme.Spacing.lg)
                    .padding(.vertical, Theme.Spacing.md)
                }
            }
        }
        .background(Theme.Colors.background)
        .sheet(isPresented: $showConnectSheet) {
            ConnectTonalView()
        }
        .onAppear { subscribeToUser() }
    }

    /// Subscribe to users:getMe so dashboard auto-updates after Tonal connection.
    private func subscribeToUser() {
        guard cancellable == nil else { return }
        cancellable = convex.client
            .subscribe(to: "users:getMe", yielding: UserInfo.self)
            .receive(on: DispatchQueue.main)
            .sink(
                receiveCompletion: { _ in
                    isLoaded = true
                },
                receiveValue: { info in
                    userInfo = info
                    isLoaded = true
                }
            )
    }

    private var connectPromptCard: some View {
        VStack(spacing: Theme.Spacing.md) {
            Image(systemName: "dumbbell.fill")
                .font(.system(size: 32))
                .foregroundStyle(Theme.Colors.primary)
                .accessibilityHidden(true)

            Text("Connect Your Tonal")
                .font(Theme.Typography.title2)
                .foregroundStyle(Theme.Colors.textPrimary)

            Text("Link your Tonal account to see strength scores, muscle readiness, and workout history.")
                .font(Theme.Typography.callout)
                .foregroundStyle(Theme.Colors.textSecondary)
                .multilineTextAlignment(.center)

            Button {
                showConnectSheet = true
            } label: {
                Text("Connect")
                    .primaryButtonStyle()
            }
        }
        .padding(Theme.Spacing.xl)
        .frame(maxWidth: .infinity)
        .background(Theme.Colors.card)
        .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.CornerRadius.lg, style: .continuous)
                .stroke(Theme.Colors.primary.opacity(0.3), lineWidth: 1)
        )
    }

}

/// Placeholder view for tabs not yet implemented.
struct ComingSoonView: View {
    let title: String
    let icon: String

    var body: some View {
        ZStack {
            Theme.Colors.background
                .ignoresSafeArea()

            VStack(spacing: 16) {
                Image(systemName: icon)
                    .font(.system(size: 48))
                    .foregroundStyle(Theme.Colors.textTertiary)

                Text(title)
                    .font(Theme.Typography.title2)
                    .foregroundStyle(Theme.Colors.textPrimary)

                Text("Coming Soon")
                    .font(Theme.Typography.body)
                    .foregroundStyle(Theme.Colors.textTertiary)
            }
        }
    }
}
