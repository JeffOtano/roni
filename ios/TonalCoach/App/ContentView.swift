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

            ComingSoonView(title: AppTab.schedule.rawValue, icon: AppTab.schedule.icon)
                .tabItem {
                    Label(AppTab.schedule.rawValue, systemImage: AppTab.schedule.icon)
                }
                .tag(AppTab.schedule)

            NavigationStack {
                HealthDashboardView()
                    .navigationTitle("Dashboard")
                    .navigationBarTitleDisplayMode(.large)
            }
            .tabItem {
                Label(AppTab.dashboard.rawValue, systemImage: AppTab.dashboard.icon)
            }
            .tag(AppTab.dashboard)

            ComingSoonView(title: AppTab.chat.rawValue, icon: AppTab.chat.icon)
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
