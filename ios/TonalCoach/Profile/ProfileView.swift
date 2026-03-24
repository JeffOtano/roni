import SwiftUI

/// Profile/settings tab with notification preferences, health connection, and app info.
struct ProfileView: View {
    @Environment(\.healthKitManager) private var healthManager
    @Environment(\.authManager) private var authManager
    @AppStorage("hasCompletedOnboarding") private var hasCompletedOnboarding = true
    @AppStorage("isGuestMode") private var isGuestMode = false

    var body: some View {
        List {
            // MARK: - Account Section
            Section {
                if authManager.isAuthenticated {
                    HStack {
                        Image(systemName: "person.circle.fill")
                            .foregroundStyle(Theme.Colors.primary)
                            .frame(width: 28)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Signed in as")
                                .font(Theme.Typography.caption)
                                .foregroundStyle(Theme.Colors.textTertiary)
                            Text(authManager.currentEmail ?? "Unknown")
                                .font(Theme.Typography.body)
                                .foregroundStyle(Theme.Colors.textPrimary)
                        }
                    }
                    .listRowBackground(Theme.Colors.card)

                    Button {
                        Task { await authManager.signOut() }
                    } label: {
                        HStack {
                            Image(systemName: "arrow.right.square")
                                .foregroundStyle(Theme.Colors.destructive)
                                .frame(width: 28)
                            Text("Sign Out")
                                .font(Theme.Typography.body)
                                .foregroundStyle(Theme.Colors.destructive)
                        }
                    }
                    .listRowBackground(Theme.Colors.card)
                } else {
                    Button {
                        isGuestMode = false
                    } label: {
                        HStack {
                            Image(systemName: "person.badge.plus")
                                .foregroundStyle(Theme.Colors.primary)
                                .frame(width: 28)
                            Text("Sign In")
                                .font(Theme.Typography.body)
                                .foregroundStyle(Theme.Colors.primary)
                        }
                    }
                    .listRowBackground(Theme.Colors.card)
                }
            } header: {
                Text("Account")
                    .foregroundStyle(Theme.Colors.textTertiary)
            }

            // MARK: - Health Section
            Section {
                HStack {
                    Image(systemName: "heart.fill")
                        .foregroundStyle(.red)
                        .frame(width: 28)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Apple Health")
                            .font(Theme.Typography.body)
                            .foregroundStyle(Theme.Colors.textPrimary)
                        Text(healthManager.isAuthorized ? "Connected" : "Not connected")
                            .font(Theme.Typography.caption)
                            .foregroundStyle(healthManager.isAuthorized ? Theme.Colors.success : Theme.Colors.textTertiary)
                    }
                    Spacer()
                    if !healthManager.isAuthorized {
                        Button("Connect") {
                            Task { try? await healthManager.requestAuthorization() }
                        }
                        .font(Theme.Typography.calloutMedium)
                        .foregroundStyle(Theme.Colors.primary)
                    }
                }
                .listRowBackground(Theme.Colors.card)
            } header: {
                Text("Health")
                    .foregroundStyle(Theme.Colors.textTertiary)
            }

            // MARK: - Notifications Section
            Section {
                NavigationLink {
                    NotificationSettingsView()
                } label: {
                    HStack {
                        Image(systemName: "bell.fill")
                            .foregroundStyle(Theme.Colors.primary)
                            .frame(width: 28)
                        Text("Notification Settings")
                            .font(Theme.Typography.body)
                            .foregroundStyle(Theme.Colors.textPrimary)
                    }
                }
                .listRowBackground(Theme.Colors.card)
            } header: {
                Text("Notifications")
                    .foregroundStyle(Theme.Colors.textTertiary)
            }

            // MARK: - App Section
            Section {
                HStack {
                    Text("Version")
                        .font(Theme.Typography.body)
                        .foregroundStyle(Theme.Colors.textPrimary)
                    Spacer()
                    Text(Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0")
                        .font(Theme.Typography.monoText)
                        .foregroundStyle(Theme.Colors.textTertiary)
                }
                .listRowBackground(Theme.Colors.card)

                Link(destination: URL(string: "https://tonal.coach")!) {
                    HStack {
                        Image(systemName: "globe")
                            .foregroundStyle(Theme.Colors.primary)
                            .frame(width: 28)
                        Text("Visit tonal.coach")
                            .font(Theme.Typography.body)
                            .foregroundStyle(Theme.Colors.textPrimary)
                        Spacer()
                        Image(systemName: "arrow.up.right")
                            .font(.system(size: 12))
                            .foregroundStyle(Theme.Colors.textTertiary)
                    }
                }
                .listRowBackground(Theme.Colors.card)

                Button(role: .destructive) {
                    hasCompletedOnboarding = false
                } label: {
                    HStack {
                        Image(systemName: "arrow.counterclockwise")
                            .foregroundStyle(Theme.Colors.destructive)
                            .frame(width: 28)
                        Text("Reset Onboarding")
                            .font(Theme.Typography.body)
                            .foregroundStyle(Theme.Colors.destructive)
                    }
                }
                .listRowBackground(Theme.Colors.card)
            } header: {
                Text("App")
                    .foregroundStyle(Theme.Colors.textTertiary)
            }
        }
        .scrollContentBackground(.hidden)
        .background(Theme.Colors.background)
        .navigationTitle("Profile")
        .navigationBarTitleDisplayMode(.large)
    }
}
