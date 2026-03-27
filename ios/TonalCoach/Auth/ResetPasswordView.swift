import SwiftUI

// MARK: - ResetPasswordView

/// Three-step password reset flow: enter email, enter OTP + new password, success.
///
/// Accepts `initialEmail` from the presenting LoginView to reduce friction.
/// Uses `AuthManager` for network calls and auto-signs the user in on success.
struct ResetPasswordView: View {
    let initialEmail: String

    @Environment(\.authManager) private var authManager
    @Environment(\.dismiss) private var dismiss

    @State private var step = 1
    @State private var email = ""
    @State private var code = ""
    @State private var newPassword = ""
    @State private var confirmPassword = ""
    @State private var localError: String?
    @State private var codeSent = false
    @State private var showSuccessCheckmark = false

    var body: some View {
        ZStack {
            Theme.Colors.background
                .ignoresSafeArea()

            VStack(spacing: 0) {
                navigationBar

                Spacer(minLength: 0)

                Group {
                    switch step {
                    case 1:
                        emailStep
                    case 2:
                        codeStep
                    case 3:
                        successStep
                    default:
                        EmptyView()
                    }
                }
                .transition(.asymmetric(
                    insertion: .move(edge: .trailing).combined(with: .opacity),
                    removal: .move(edge: .leading).combined(with: .opacity)
                ))

                Spacer(minLength: 0)

                stepIndicator
                    .padding(.bottom, Theme.Spacing.xl)
            }
        }
        .animation(Animate.smooth, value: step)
        .onAppear {
            email = initialEmail
        }
    }

    // MARK: - Navigation Bar

    private var navigationBar: some View {
        HStack {
            if step > 1 && step < 3 {
                Button {
                    goBack()
                } label: {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 18, weight: .medium))
                        .foregroundStyle(Theme.Colors.textSecondary)
                        .frame(width: 44, height: 44)
                        .contentShape(Rectangle())
                }
                .accessibilityLabel("Go back")
            } else {
                // Close button on step 1, hidden on step 3
                Button {
                    dismiss()
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 16, weight: .medium))
                        .foregroundStyle(Theme.Colors.textSecondary)
                        .frame(width: 44, height: 44)
                        .contentShape(Rectangle())
                }
                .accessibilityLabel("Close")
                .opacity(step == 3 ? 0 : 1)
                .disabled(step == 3)
            }

            Spacer()
        }
        .padding(.horizontal, Theme.Spacing.sm)
        .padding(.top, Theme.Spacing.sm)
    }

    // MARK: - Step 1: Enter Email

    private var emailStep: some View {
        VStack(spacing: Theme.Spacing.xl) {
            VStack(spacing: Theme.Spacing.sm) {
                Text("Reset Password")
                    .font(Theme.Typography.title)
                    .foregroundStyle(Theme.Colors.textPrimary)

                Text("Enter your email and we'll send you a code")
                    .font(Theme.Typography.callout)
                    .foregroundStyle(Theme.Colors.textSecondary)
                    .multilineTextAlignment(.center)
            }

            if codeSent {
                codeSentConfirmation
            } else {
                emailForm
            }
        }
        .padding(.horizontal, Theme.Spacing.xl)
    }

    private var emailForm: some View {
        VStack(spacing: Theme.Spacing.lg) {
            TextField("Email", text: $email)
                .font(Theme.Typography.body)
                .foregroundStyle(Theme.Colors.textPrimary)
                .keyboardType(.emailAddress)
                .textContentType(.emailAddress)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .padding(Theme.Spacing.md)
                .background(Theme.Colors.card)
                .clipShape(
                    RoundedRectangle(cornerRadius: Theme.CornerRadius.md)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.CornerRadius.md)
                        .stroke(Theme.Colors.border, lineWidth: 1)
                )
                .accessibilityLabel("Email address")

            errorBanner

            Button {
                Task { await sendResetCode() }
            } label: {
                Group {
                    if authManager.isLoading {
                        ProgressView()
                            .tint(Theme.Colors.primaryForeground)
                    } else {
                        Text("Send Reset Code")
                    }
                }
                .frame(maxWidth: .infinity)
                .primaryButtonStyle()
            }
            .disabled(email.isEmpty || authManager.isLoading)
            .opacity(email.isEmpty ? 0.5 : 1.0)
            .accessibilityLabel("Send reset code")
        }
    }

    private var codeSentConfirmation: some View {
        VStack(spacing: Theme.Spacing.md) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 48))
                .foregroundStyle(Theme.Colors.success)
                .symbolEffect(.bounce, value: codeSent)

            Text("Check your email")
                .font(Theme.Typography.headline)
                .foregroundStyle(Theme.Colors.success)
        }
        .transition(.scale.combined(with: .opacity))
    }

    // MARK: - Step 2: Enter Code + New Password

    private var codeStep: some View {
        ScrollView {
            VStack(spacing: Theme.Spacing.xl) {
                VStack(spacing: Theme.Spacing.sm) {
                    Text("Enter Code")
                        .font(Theme.Typography.title)
                        .foregroundStyle(Theme.Colors.textPrimary)

                    Text("We sent an 8-digit code to \(email)")
                        .font(Theme.Typography.callout)
                        .foregroundStyle(Theme.Colors.textSecondary)
                        .multilineTextAlignment(.center)
                }

                VStack(spacing: Theme.Spacing.lg) {
                    codeField
                    newPasswordField
                    confirmPasswordField
                }

                errorBanner

                Button {
                    Task { await resetPassword() }
                } label: {
                    Group {
                        if authManager.isLoading {
                            ProgressView()
                                .tint(Theme.Colors.primaryForeground)
                        } else {
                            Text("Reset Password")
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .primaryButtonStyle()
                }
                .disabled(!isStep2Valid || authManager.isLoading)
                .opacity(isStep2Valid ? 1.0 : 0.5)
                .accessibilityLabel("Reset password")

                Button {
                    Task { await resendCode() }
                } label: {
                    Text("Resend code")
                        .font(Theme.Typography.callout)
                        .foregroundStyle(Theme.Colors.primary)
                }
                .disabled(authManager.isLoading)
                .accessibilityLabel("Resend verification code")
            }
            .padding(.horizontal, Theme.Spacing.xl)
            .padding(.vertical, Theme.Spacing.lg)
        }
    }

    private var codeField: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
            Text("Verification Code")
                .font(Theme.Typography.callout)
                .foregroundStyle(Theme.Colors.textSecondary)

            TextField("12345678", text: $code)
                .font(Theme.Typography.title)
                .foregroundStyle(Theme.Colors.textPrimary)
                .multilineTextAlignment(.center)
                .tracking(6)
                .keyboardType(.numberPad)
                .textContentType(.oneTimeCode)
                .onChange(of: code) { _, newValue in
                    let filtered = newValue.filter(\.isNumber)
                    if filtered.count > 8 {
                        code = String(filtered.prefix(8))
                    } else if filtered != newValue {
                        code = filtered
                    }
                }
                .padding(Theme.Spacing.md)
                .background(Theme.Colors.card)
                .clipShape(
                    RoundedRectangle(cornerRadius: Theme.CornerRadius.md)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.CornerRadius.md)
                        .stroke(Theme.Colors.border, lineWidth: 1)
                )
                .accessibilityLabel("8-digit verification code")
        }
    }

    private var newPasswordField: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
            Text("New Password")
                .font(Theme.Typography.callout)
                .foregroundStyle(Theme.Colors.textSecondary)

            SecureField("At least 8 characters", text: $newPassword)
                .font(Theme.Typography.body)
                .foregroundStyle(Theme.Colors.textPrimary)
                .textContentType(.newPassword)
                .padding(Theme.Spacing.md)
                .background(Theme.Colors.card)
                .clipShape(
                    RoundedRectangle(cornerRadius: Theme.CornerRadius.md)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.CornerRadius.md)
                        .stroke(Theme.Colors.border, lineWidth: 1)
                )
                .accessibilityLabel("New password, at least 8 characters")
        }
    }

    private var confirmPasswordField: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
            Text("Confirm Password")
                .font(Theme.Typography.callout)
                .foregroundStyle(Theme.Colors.textSecondary)

            SecureField("Repeat new password", text: $confirmPassword)
                .font(Theme.Typography.body)
                .foregroundStyle(Theme.Colors.textPrimary)
                .textContentType(.newPassword)
                .padding(Theme.Spacing.md)
                .background(Theme.Colors.card)
                .clipShape(
                    RoundedRectangle(cornerRadius: Theme.CornerRadius.md)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.CornerRadius.md)
                        .stroke(Theme.Colors.border, lineWidth: 1)
                )
                .accessibilityLabel("Confirm new password")
        }
    }

    // MARK: - Step 3: Success

    private var successStep: some View {
        VStack(spacing: Theme.Spacing.xl) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 72))
                .foregroundStyle(Theme.Colors.success)
                .scaleEffect(showSuccessCheckmark ? 1.0 : 0.3)
                .opacity(showSuccessCheckmark ? 1.0 : 0.0)
                .animation(
                    .spring(response: 0.5, dampingFraction: 0.6),
                    value: showSuccessCheckmark
                )

            VStack(spacing: Theme.Spacing.sm) {
                Text("Password Reset")
                    .font(Theme.Typography.title)
                    .foregroundStyle(Theme.Colors.textPrimary)

                Text("You're all set. Signing you in...")
                    .font(Theme.Typography.callout)
                    .foregroundStyle(Theme.Colors.textSecondary)
            }
        }
        .padding(.horizontal, Theme.Spacing.xl)
        .onAppear {
            showSuccessCheckmark = true
            Theme.Haptics.success()
            DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
                dismiss()
            }
        }
    }

    // MARK: - Shared Components

    private var errorBanner: some View {
        Group {
            if let displayError {
                HStack(spacing: Theme.Spacing.sm) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.system(size: 14))

                    Text(displayError)
                        .font(Theme.Typography.callout)
                }
                .foregroundStyle(Theme.Colors.destructive)
                .padding(Theme.Spacing.md)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Theme.Colors.destructive.opacity(0.1))
                .clipShape(
                    RoundedRectangle(cornerRadius: Theme.CornerRadius.md)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.CornerRadius.md)
                        .stroke(
                            Theme.Colors.destructive.opacity(0.2),
                            lineWidth: 1
                        )
                )
                .transition(.opacity.combined(with: .move(edge: .top)))
                .accessibilityLabel("Error: \(displayError)")
            }
        }
        .animation(Animate.snappy, value: displayError != nil)
    }

    private var stepIndicator: some View {
        HStack(spacing: Theme.Spacing.sm) {
            ForEach(1 ... 3, id: \.self) { dotStep in
                Circle()
                    .fill(
                        dotStep == step
                            ? Theme.Colors.primary
                            : Theme.Colors.tertiaryForeground
                    )
                    .frame(width: 8, height: 8)
            }
        }
        .padding(.top, Theme.Spacing.lg)
        .accessibilityLabel("Step \(step) of 3")
    }

    // MARK: - Computed Properties

    private var isStep2Valid: Bool {
        code.count == 8
            && newPassword.count >= 8
            && newPassword == confirmPassword
    }

    /// Merges `authManager.error` with local validation errors.
    private var displayError: String? {
        localError ?? authManager.error
    }

    // MARK: - Actions

    private func sendResetCode() async {
        clearErrors()
        await authManager.requestPasswordReset(email: email)

        if authManager.error == nil {
            Theme.Haptics.success()
            withAnimation {
                codeSent = true
            }
            try? await Task.sleep(for: .seconds(1.5))
            withAnimation {
                step = 2
                codeSent = false
            }
        } else {
            Theme.Haptics.error()
        }
    }

    private func resetPassword() async {
        clearErrors()

        // Client-side validation before network call
        if newPassword.count < 8 {
            localError = "Password must be at least 8 characters."
            Theme.Haptics.error()
            return
        }
        if newPassword != confirmPassword {
            localError = "Passwords do not match."
            Theme.Haptics.error()
            return
        }

        await authManager.confirmPasswordReset(
            email: email,
            code: code,
            newPassword: newPassword
        )

        if authManager.error == nil {
            withAnimation {
                step = 3
            }
        } else {
            Theme.Haptics.error()
        }
    }

    private func resendCode() async {
        clearErrors()
        await authManager.requestPasswordReset(email: email)
        if authManager.error == nil {
            Theme.Haptics.light()
        } else {
            Theme.Haptics.error()
        }
    }

    private func goBack() {
        clearErrors()
        withAnimation {
            step -= 1
        }
    }

    private func clearErrors() {
        localError = nil
        authManager.error = nil
    }
}

// MARK: - Preview

#Preview {
    ResetPasswordView(initialEmail: "user@example.com")
        .preferredColorScheme(.dark)
}
