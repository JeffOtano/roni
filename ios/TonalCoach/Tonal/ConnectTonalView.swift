import SwiftUI

// MARK: - Connect Tonal View

/// Sheet-presented form for linking a user's Tonal hardware account.
///
/// This view collects Tonal credentials (separate from the tonal.coach account)
/// and calls the `connectTonal` action to authenticate with the Tonal API.
/// On success it dismisses automatically with haptic feedback.
struct ConnectTonalView: View {
    @Environment(ConvexManager.self) private var convex
    @Environment(\.dismiss) private var dismiss

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

    // MARK: - Derived State

    private var canSubmit: Bool {
        !email.isEmpty && !password.isEmpty && !isLoading
    }

    // MARK: - Body

    var body: some View {
        ZStack(alignment: .topTrailing) {
            Theme.Colors.background
                .ignoresSafeArea()
                .onTapGesture { focusedField = nil }

            dismissButton
                .zIndex(1)

            ScrollView {
                VStack(spacing: Theme.Spacing.xl) {
                    icon
                    titleSection
                    noteText
                    formFields
                    errorBanner
                    connectButton
                }
                .padding(.horizontal, Theme.Spacing.lg)
                .padding(.top, Theme.Spacing.xxxl)
                .padding(.bottom, Theme.Spacing.xl)
            }
        }
    }

    // MARK: - Dismiss Button

    private var dismissButton: some View {
        Button {
            dismiss()
        } label: {
            Image(systemName: "xmark")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Theme.Colors.textSecondary)
                .frame(width: 44, height: 44)
                .contentShape(Rectangle())
        }
        .padding(.top, Theme.Spacing.sm)
        .padding(.trailing, Theme.Spacing.md)
        .accessibilityLabel("Close")
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
            emailField
            passwordField
        }
    }

    private var emailField: some View {
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
                    RoundedRectangle(
                        cornerRadius: Theme.CornerRadius.md,
                        style: .continuous
                    )
                )
                .overlay(
                    RoundedRectangle(
                        cornerRadius: Theme.CornerRadius.md,
                        style: .continuous
                    )
                    .stroke(
                        focusedField == .email
                            ? Theme.Colors.ring
                            : Theme.Colors.input,
                        lineWidth: 1
                    )
                )
                .accessibilityLabel("Tonal email address")
        }
    }

    private var passwordField: some View {
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
                    RoundedRectangle(
                        cornerRadius: Theme.CornerRadius.md,
                        style: .continuous
                    )
                )
                .overlay(
                    RoundedRectangle(
                        cornerRadius: Theme.CornerRadius.md,
                        style: .continuous
                    )
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
                RoundedRectangle(
                    cornerRadius: Theme.CornerRadius.md,
                    style: .continuous
                )
            )
            .overlay(
                RoundedRectangle(
                    cornerRadius: Theme.CornerRadius.md,
                    style: .continuous
                )
                .stroke(Theme.Colors.destructive.opacity(0.25), lineWidth: 1)
            )
            .transition(.move(edge: .top).combined(with: .opacity))
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(.isStaticText)
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
                RoundedRectangle(
                    cornerRadius: Theme.CornerRadius.md,
                    style: .continuous
                )
            )
        }
        .disabled(!canSubmit)
        .accessibilityLabel(isLoading ? "Connecting to Tonal" : "Connect")
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
                    dismiss()
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
        return "Invalid email or password for your Tonal account"
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

#Preview("Connect Tonal") {
    ConnectTonalView()
        .environment(ConvexManager())
        .preferredColorScheme(.dark)
}
