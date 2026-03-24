import SwiftUI

// MARK: - Auth Mode

/// Toggleable mode for the login form.
private enum AuthMode: String, CaseIterable {
    case signIn = "Sign In"
    case signUp = "Sign Up"
}

// MARK: - Login View

/// Email/password login screen with sign-in and sign-up modes.
///
/// This is the first screen users see when not authenticated. It provides:
/// - Segmented control to toggle between sign in and sign up
/// - Email and password fields with validation
/// - Error banner with auto-dismiss
/// - Forgot password navigation (sign-in mode)
/// - Guest browsing escape hatch
struct LoginView: View {
    @Environment(\.authManager) private var authManager
    @AppStorage("isGuestMode") private var isGuestMode = false

    @State private var mode: AuthMode = .signIn
    @State private var email = ""
    @State private var password = ""
    @State private var errorMessage: String?
    @State private var errorDismissTask: Task<Void, Never>?

    @FocusState private var focusedField: Field?

    private enum Field: Hashable {
        case email
        case password
    }

    // MARK: - Derived State

    private var isSignUp: Bool { mode == .signUp }

    private var passwordIsValid: Bool {
        !isSignUp || password.count >= 8
    }

    private var canSubmit: Bool {
        !email.isEmpty && !password.isEmpty && passwordIsValid && !authManager.isLoading
    }

    private var ctaLabel: String {
        isSignUp ? "Create Account" : "Sign In"
    }

    // MARK: - Body

    var body: some View {
        ZStack {
            Theme.Colors.background
                .ignoresSafeArea()
                .onTapGesture { focusedField = nil }

            ScrollView {
                VStack(spacing: Theme.Spacing.xl) {
                    Spacer(minLength: Theme.Spacing.xxxl)

                    logo
                    segmentedControl
                    formFields
                    errorBanner
                    ctaButton
                    bottomLinks
                    guestButton

                    Spacer(minLength: Theme.Spacing.xl)
                }
                .padding(.horizontal, Theme.Spacing.lg)
            }
            .scrollDismissesKeyboard(.interactively)
        }
        .onChange(of: authManager.error) { _, newError in
            if let newError {
                showError(newError)
            }
        }
        .onChange(of: mode) { _, _ in
            dismissError()
        }
    }

    // MARK: - Logo

    private var logo: some View {
        Text("tonal.coach")
            .font(.system(size: 36, weight: .bold, design: .default))
            .foregroundStyle(Theme.Colors.primary)
            .padding(.bottom, Theme.Spacing.sm)
            .accessibilityAddTraits(.isHeader)
    }

    // MARK: - Segmented Control

    private var segmentedControl: some View {
        Picker("Auth mode", selection: $mode) {
            ForEach(AuthMode.allCases, id: \.self) { authMode in
                Text(authMode.rawValue).tag(authMode)
            }
        }
        .pickerStyle(.segmented)
        .padding(.horizontal, Theme.Spacing.xl)
        .onChange(of: mode) { _, _ in
            Theme.Haptics.selection()
        }
    }

    // MARK: - Form Fields

    private var formFields: some View {
        VStack(spacing: Theme.Spacing.lg) {
            emailField
            passwordField

            if isSignUp {
                passwordHint
            }
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
                .disabled(authManager.isLoading)
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
                .accessibilityLabel("Email address")
        }
    }

    private var passwordField: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
            Text("Password")
                .font(Theme.Typography.calloutMedium)
                .foregroundStyle(Theme.Colors.textSecondary)

            SecureField("Enter your password", text: $password)
                .font(Theme.Typography.body)
                .foregroundStyle(Theme.Colors.textPrimary)
                .textContentType(isSignUp ? .newPassword : .password)
                .submitLabel(.go)
                .focused($focusedField, equals: .password)
                .onSubmit { submitIfValid() }
                .disabled(authManager.isLoading)
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
                .accessibilityLabel("Password")
        }
    }

    private var passwordHint: some View {
        Text("8 characters minimum")
            .font(Theme.Typography.caption)
            .foregroundStyle(
                password.isEmpty
                    ? Theme.Colors.textTertiary
                    : passwordIsValid
                        ? Theme.Colors.success
                        : Theme.Colors.destructive
            )
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityLabel(
                password.isEmpty
                    ? "Password must be at least 8 characters"
                    : passwordIsValid
                        ? "Password meets minimum length"
                        : "Password is too short"
            )
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

    // MARK: - CTA Button

    private var ctaButton: some View {
        Button {
            submit()
        } label: {
            Group {
                if authManager.isLoading {
                    ProgressView()
                        .tint(Theme.Colors.primaryForeground)
                } else {
                    Text(ctaLabel)
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
        .accessibilityLabel(
            authManager.isLoading
                ? (isSignUp ? "Creating account" : "Signing in")
                : ctaLabel
        )
    }

    // MARK: - Bottom Links

    private var bottomLinks: some View {
        VStack(spacing: Theme.Spacing.md) {
            if !isSignUp {
                NavigationLink {
                    ResetPasswordView(initialEmail: email)
                } label: {
                    Text("Forgot password?")
                        .font(Theme.Typography.callout)
                        .foregroundStyle(Theme.Colors.primary)
                }
            }
        }
    }

    // MARK: - Guest Button

    private var guestButton: some View {
        Button {
            isGuestMode = true
        } label: {
            Text("Browse as Guest")
                .font(Theme.Typography.callout)
                .foregroundStyle(Theme.Colors.textSecondary)
        }
        .padding(.top, Theme.Spacing.sm)
    }

    // MARK: - Actions

    private func submitIfValid() {
        guard canSubmit else { return }
        submit()
    }

    private func submit() {
        focusedField = nil
        dismissError()

        Task {
            if isSignUp {
                await authManager.signUp(email: email, password: password)
            } else {
                await authManager.signIn(email: email, password: password)
            }

            if authManager.error == nil {
                Theme.Haptics.success()
            }
        }
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
        authManager.error = nil
    }
}

// ResetPasswordView is defined in ResetPasswordView.swift

// MARK: - Preview

#Preview("Sign In") {
    NavigationStack {
        LoginView()
    }
    .preferredColorScheme(.dark)
}

#Preview("Sign Up") {
    NavigationStack {
        LoginView()
    }
    .preferredColorScheme(.dark)
}
