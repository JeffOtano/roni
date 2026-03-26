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
    var initialTab: AppTab = .chat

    @State private var selectedTab: AppTab = .chat

    init(initialTab: AppTab = .chat) {
        self.initialTab = initialTab
        _selectedTab = State(initialValue: initialTab)
    }

    var body: some View {
        TabView(selection: $selectedTab) {
            ChatView()
                .tabItem {
                    Label {
                        Text(AppTab.chat.rawValue)
                    } icon: {
                        Image(systemName: AppTab.chat.icon)
                            .symbolEffect(.bounce, value: selectedTab)
                    }
                }
                .tag(AppTab.chat)

            ScheduleView()
                .tabItem {
                    Label {
                        Text(AppTab.schedule.rawValue)
                    } icon: {
                        Image(systemName: AppTab.schedule.icon)
                            .symbolEffect(.bounce, value: selectedTab)
                    }
                }
                .tag(AppTab.schedule)

            NavigationStack {
                DashboardRouter(selectedTab: $selectedTab)
                    .navigationTitle("Dashboard")
                    .navigationBarTitleDisplayMode(.large)
            }
            .tabItem {
                Label {
                    Text(AppTab.dashboard.rawValue)
                } icon: {
                    Image(systemName: AppTab.dashboard.icon)
                        .symbolEffect(.bounce, value: selectedTab)
                }
            }
            .tag(AppTab.dashboard)

            LibraryHomeView()
                .tabItem {
                    Label {
                        Text(AppTab.library.rawValue)
                    } icon: {
                        Image(systemName: AppTab.library.icon)
                            .symbolEffect(.bounce, value: selectedTab)
                    }
                }
                .tag(AppTab.library)

            NavigationStack {
                ProfileView()
            }
            .tabItem {
                Label {
                    Text(AppTab.profile.rawValue)
                } icon: {
                    Image(systemName: AppTab.profile.icon)
                        .symbolEffect(.bounce, value: selectedTab)
                }
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

/// Always shows the unified dashboard. Cards degrade gracefully when data is unavailable.
/// An inline connect-Tonal prompt appears if the user has not linked their Tonal account.
private struct DashboardRouter: View {
    @Environment(ConvexManager.self) private var convex
    @Binding var selectedTab: AppTab
    @State private var userInfo: UserInfo?
    @State private var showConnectSheet = false
    @State private var cancellable: AnyCancellable?

    private var needsConnect: Bool {
        guard let info = userInfo else { return false }
        return !info.hasTonalProfile || info.tonalTokenExpired
    }

    var body: some View {
        TonalDashboardView(selectedTab: $selectedTab)
            .safeAreaInset(edge: .top) {
                if needsConnect {
                    connectPromptCard
                        .padding(.horizontal, Theme.Spacing.lg)
                        .padding(.bottom, Theme.Spacing.sm)
                }
            }
            .background(Theme.Colors.background)
            .sheet(isPresented: $showConnectSheet) {
                ConnectTonalView()
            }
            .onAppear { subscribeToUser() }
    }

    /// Subscribe to users:getMe so the connect prompt auto-hides after linking.
    private func subscribeToUser() {
        guard cancellable == nil else { return }
        cancellable = convex.client
            .subscribe(to: "users:getMe", yielding: UserInfo.self)
            .receive(on: DispatchQueue.main)
            .sink(
                receiveCompletion: { _ in },
                receiveValue: { info in
                    userInfo = info
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

            Text("Link your Tonal account to see strength scores and workout history.")
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
