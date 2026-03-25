import Combine
import ConvexMobile
import SwiftUI

// MARK: - Training Onboarding Flow

/// Orchestrates the 3-step training onboarding:
/// 1. Connect Tonal account
/// 2. Set training preferences
/// 3. Completion / ready screen
///
/// Automatically skips step 1 if the user already has a Tonal profile.
/// On completion, dismisses the onboarding flow by setting the target tab
/// on the parent view.
struct TrainingOnboardingFlow: View {
    let onComplete: (AppTab) -> Void

    @Environment(ConvexManager.self) private var convex

    @State private var step = 1
    @State private var userInfo: UserInfo?
    @State private var isLoaded = false
    @State private var cancellable: AnyCancellable?

    // MARK: - Body

    var body: some View {
        Group {
            if !isLoaded {
                loadingView
            } else {
                stepContent
                    .transition(.asymmetric(
                        insertion: .move(edge: .trailing).combined(with: .opacity),
                        removal: .move(edge: .leading).combined(with: .opacity)
                    ))
            }
        }
        .animation(Animate.smooth, value: step)
        .onAppear { subscribeToUser() }
    }

    // MARK: - Loading

    private var loadingView: some View {
        ZStack {
            Theme.Colors.background
                .ignoresSafeArea()

            ProgressView()
                .tint(Theme.Colors.primary)
        }
    }

    // MARK: - Step Content

    @ViewBuilder
    private var stepContent: some View {
        switch step {
        case 1:
            connectTonalStep
        case 2:
            TrainingPreferencesView(onComplete: {
                withAnimation { step = 3 }
            })
        case 3:
            OnboardingReadyView(onComplete: { tab in
                onComplete(tab)
            })
        default:
            EmptyView()
        }
    }

    // MARK: - Connect Tonal Step

    /// Wraps the existing ConnectTonalView as a full-screen step (not a sheet)
    /// with the step indicator and a skip option.
    private var connectTonalStep: some View {
        ZStack {
            Theme.Colors.background
                .ignoresSafeArea()

            VStack(spacing: 0) {
                // Step indicator at top
                VStack(spacing: Theme.Spacing.sm) {
                    Text("Step 1 of 3")
                        .font(Theme.Typography.caption)
                        .foregroundStyle(Theme.Colors.textSecondary)

                    HStack(spacing: Theme.Spacing.sm) {
                        ForEach(1...3, id: \.self) { s in
                            Circle()
                                .fill(s <= 1 ? Theme.Colors.primary : Theme.Colors.tertiaryForeground)
                                .frame(width: 8, height: 8)
                        }
                    }
                }
                .padding(.top, Theme.Spacing.xl)
                .accessibilityElement(children: .combine)
                .accessibilityLabel("Step 1 of 3")

                // Reuse existing ConnectTonalView content inline
                ConnectTonalStepView(onComplete: {
                    withAnimation { step = 2 }
                })
            }
        }
    }

    // MARK: - User Subscription

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

                    // If onboarding already done, skip everything
                    if info.onboardingCompleted {
                        onComplete(.chat)
                        return
                    }

                    // If Tonal already connected, skip to step 2
                    if info.hasTonalProfile && step == 1 {
                        step = 2
                    }

                    isLoaded = true
                }
            )
    }
}

// MARK: - Connect Tonal Step View

/// An inline version of ConnectTonalView for the onboarding flow (no dismiss button,
/// includes a Skip option). Reuses the same Convex action and form styling.
private struct ConnectTonalStepView: View {
    let onComplete: () -> Void

    @Environment(ConvexManager.self) private var convex

    @State private var email = ""
    @State private var password = ""
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var errorDismissTask: Task<Void, Never>?

    @FocusState private var focusedField: Field?

    private enum Field: Hashable {
        case email
        case password
    }

    private var canSubmit: Bool {
        !email.isEmpty && !password.isEmpty && !isLoading
    }

    // MARK: - Body

    var body: some View {
        ScrollView {
            VStack(spacing: Theme.Spacing.xl) {
                icon
                titleSection
                noteText
                formFields
                errorBanner
                connectButton
                skipButton
            }
            .padding(.horizontal, Theme.Spacing.lg)
            .padding(.top, Theme.Spacing.xl)
            .padding(.bottom, Theme.Spacing.xl)
        }
        .onTapGesture { focusedField = nil }
    }

    // MARK: - Icon

    private var icon: some View {
        Image(systemName: "dumbbell.fill")
            .font(.system(size: 44))
            .foregroundStyle(Theme.Colors.primary)
            .accessibilityHidden(true)
    }

    // MARK: - Title Section

    private var titleSection: some View {
        VStack(spacing: Theme.Spacing.sm) {
            Text("Connect Your Tonal")
                .font(Theme.Typography.title)
                .foregroundStyle(Theme.Colors.textPrimary)
                .accessibilityAddTraits(.isHeader)

            Text(
                "Sign in with your Tonal account credentials to see strength scores, muscle readiness, and workout history"
            )
            .font(Theme.Typography.callout)
            .foregroundStyle(Theme.Colors.textSecondary)
            .multilineTextAlignment(.center)
            .padding(.horizontal, Theme.Spacing.md)
        }
    }

    // MARK: - Note Text

    private var noteText: some View {
        Text("These are your Tonal credentials, not your tonal.coach account")
            .font(Theme.Typography.caption)
            .foregroundStyle(Theme.Colors.textTertiary)
            .multilineTextAlignment(.center)
    }

    // MARK: - Form Fields

    private var formFields: some View {
        VStack(spacing: Theme.Spacing.lg) {
            VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
                Text("Email")
                    .font(Theme.Typography.calloutMedium)
                    .foregroundStyle(Theme.Colors.textSecondary)

                TextField("you@example.com", text: $email)
                    .font(Theme.Typography.body)
                    .foregroundStyle(Theme.Colors.textPrimary)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .textContentType(.emailAddress)
                    .submitLabel(.next)
                    .focused($focusedField, equals: .email)
                    .onSubmit { focusedField = .password }
                    .disabled(isLoading)
                    .padding(.horizontal, Theme.Spacing.md)
                    .padding(.vertical, Theme.Spacing.md)
                    .background(Theme.Colors.card)
                    .clipShape(
                        RoundedRectangle(cornerRadius: Theme.CornerRadius.md, style: .continuous)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: Theme.CornerRadius.md, style: .continuous)
                            .stroke(
                                focusedField == .email
                                    ? Theme.Colors.ring
                                    : Theme.Colors.input,
                                lineWidth: 1
                            )
                    )
                    .accessibilityLabel("Tonal email address")
            }

            VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
                Text("Password")
                    .font(Theme.Typography.calloutMedium)
                    .foregroundStyle(Theme.Colors.textSecondary)

                SecureField("Enter your Tonal password", text: $password)
                    .font(Theme.Typography.body)
                    .foregroundStyle(Theme.Colors.textPrimary)
                    .textContentType(.password)
                    .submitLabel(.go)
                    .focused($focusedField, equals: .password)
                    .onSubmit { submitIfValid() }
                    .disabled(isLoading)
                    .padding(.horizontal, Theme.Spacing.md)
                    .padding(.vertical, Theme.Spacing.md)
                    .background(Theme.Colors.card)
                    .clipShape(
                        RoundedRectangle(cornerRadius: Theme.CornerRadius.md, style: .continuous)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: Theme.CornerRadius.md, style: .continuous)
                            .stroke(
                                focusedField == .password
                                    ? Theme.Colors.ring
                                    : Theme.Colors.input,
                                lineWidth: 1
                            )
                    )
                    .accessibilityLabel("Tonal password")
            }
        }
    }

    // MARK: - Error Banner

    @ViewBuilder
    private var errorBanner: some View {
        if let errorMessage {
            HStack(spacing: Theme.Spacing.sm) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.system(size: 14))

                Text(errorMessage)
                    .font(Theme.Typography.callout)
                    .multilineTextAlignment(.leading)
                    .frame(maxWidth: .infinity, alignment: .leading)

                Button {
                    dismissError()
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Theme.Colors.destructive.opacity(0.8))
                        .frame(width: 28, height: 28)
                        .contentShape(Rectangle())
                }
                .accessibilityLabel("Dismiss error")
            }
            .foregroundStyle(Theme.Colors.destructive)
            .padding(Theme.Spacing.md)
            .background(Theme.Colors.destructive.opacity(0.12))
            .clipShape(
                RoundedRectangle(cornerRadius: Theme.CornerRadius.md, style: .continuous)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Theme.CornerRadius.md, style: .continuous)
                    .stroke(Theme.Colors.destructive.opacity(0.25), lineWidth: 1)
            )
            .transition(.move(edge: .top).combined(with: .opacity))
            .accessibilityElement(children: .combine)
            .accessibilityLabel("Error: \(errorMessage)")
        }
    }

    // MARK: - Connect Button

    private var connectButton: some View {
        Button {
            connect()
        } label: {
            Group {
                if isLoading {
                    ProgressView()
                        .tint(Theme.Colors.primaryForeground)
                } else {
                    Text("Connect")
                }
            }
            .font(Theme.Typography.calloutMedium)
            .foregroundStyle(Theme.Colors.primaryForeground)
            .frame(maxWidth: .infinity)
            .frame(height: 48)
            .background(
                canSubmit
                    ? Theme.Colors.primary
                    : Theme.Colors.primary.opacity(0.4)
            )
            .clipShape(
                RoundedRectangle(cornerRadius: Theme.CornerRadius.md, style: .continuous)
            )
        }
        .disabled(!canSubmit)
        .accessibilityLabel(isLoading ? "Connecting to Tonal" : "Connect")
    }

    // MARK: - Skip Button

    private var skipButton: some View {
        Button {
            Theme.Haptics.light()
            onComplete()
        } label: {
            Text("Skip for now")
                .font(Theme.Typography.callout)
                .foregroundStyle(Theme.Colors.textTertiary)
                .frame(maxWidth: .infinity)
                .frame(height: 44)
                .contentShape(Rectangle())
        }
        .disabled(isLoading)
        .accessibilityLabel("Skip connecting Tonal")
    }

    // MARK: - Actions

    private func submitIfValid() {
        guard canSubmit else { return }
        connect()
    }

    private func connect() {
        focusedField = nil
        dismissError()
        isLoading = true

        Task {
            do {
                let result: ConnectTonalResult = try await convex.action(
                    "tonal/connectPublic:connectTonal",
                    with: ["tonalEmail": email, "tonalPassword": password]
                )
                isLoading = false
                if result.success {
                    Theme.Haptics.success()
                    onComplete()
                }
            } catch {
                isLoading = false
                let message = mapError(error)
                showError(message)
            }
        }
    }

    private func mapError(_ error: Error) -> String {
        let description = error.localizedDescription.lowercased()
        if description.contains("invalid") || description.contains("credentials")
            || description.contains("unauthorized") || description.contains("401")
            || description.contains("authentication")
        {
            return "Invalid email or password for your Tonal account"
        }
        if description.contains("network") || description.contains("timeout")
            || description.contains("connection") || description.contains("offline")
        {
            return "Connection error. Check your internet and try again."
        }
        return "Something went wrong. Please try again."
    }

    private func showError(_ message: String) {
        withAnimation(.easeInOut(duration: 0.25)) {
            errorMessage = message
        }
        Theme.Haptics.error()

        errorDismissTask?.cancel()
        errorDismissTask = Task {
            try? await Task.sleep(for: .seconds(5))
            guard !Task.isCancelled else { return }
            dismissError()
        }
    }

    private func dismissError() {
        errorDismissTask?.cancel()
        errorDismissTask = nil
        withAnimation(.easeInOut(duration: 0.2)) {
            errorMessage = nil
        }
    }
}

// MARK: - Preview

#Preview("Training Onboarding Flow") {
    TrainingOnboardingFlow(onComplete: { _ in })
        .environment(ConvexManager())
        .preferredColorScheme(.dark)
}
