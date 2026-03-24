import Combine
import ConvexMobile
import Foundation
import SwiftUI

/// Coordinates all authentication operations for SwiftUI views.
///
/// Views interact with this class via `@Environment(\.authManager)`.
/// It wraps `ConvexManager` auth calls, manages Keychain persistence,
/// and exposes reactive state for the UI layer.
@Observable
final class AuthManager {
    // MARK: - Public State

    /// Whether the user is currently authenticated.
    private(set) var isAuthenticated = false

    /// True during auth operations and initial session restore.
    private(set) var isLoading = true

    /// The signed-in user's email, read from Keychain on restore.
    private(set) var currentEmail: String?

    /// User-facing error message. Auto-clears on next auth operation.
    var error: String?

    // MARK: - Dependencies

    private let convexManager: ConvexManager

    // MARK: - Private

    private var cancellables = Set<AnyCancellable>()

    // MARK: - Init

    init(convexManager: ConvexManager = ConvexManager()) {
        self.convexManager = convexManager

        convexManager.authState
            .receive(on: DispatchQueue.main)
            .sink { [weak self] state in
                guard let self else { return }
                switch state {
                case .authenticated:
                    self.isAuthenticated = true
                case .unauthenticated:
                    self.isAuthenticated = false
                default:
                    break
                }
            }
            .store(in: &cancellables)
    }

    // MARK: - Sign In

    /// Authenticate with email and password.
    func signIn(email: String, password: String) async {
        clearError()
        isLoading = true
        defer { isLoading = false }

        do {
            let result: SignInResult = try await convexManager.action(
                "auth:signIn",
                with: [
                    "provider": "password",
                    "params": [
                        "email": email,
                        "password": password,
                        "flow": "signIn",
                    ] as [String: ConvexEncodable?],
                ]
            )
            try await handleTokenResult(result, email: email)
        } catch {
            self.error = parseError(error)
        }
    }

    // MARK: - Sign Up

    /// Create a new account with email and password.
    func signUp(email: String, password: String) async {
        clearError()
        isLoading = true
        defer { isLoading = false }

        do {
            let result: SignInResult = try await convexManager.action(
                "auth:signIn",
                with: [
                    "provider": "password",
                    "params": [
                        "email": email,
                        "password": password,
                        "flow": "signUp",
                    ] as [String: ConvexEncodable?],
                ]
            )
            try await handleTokenResult(result, email: email)
        } catch {
            self.error = parseError(error)
        }
    }

    // MARK: - Sign Out

    /// Sign out, clearing all stored credentials.
    func signOut() async {
        clearError()

        // Best-effort server-side sign out
        do {
            try await convexManager.action("auth:signOut", with: [:])
        } catch {
            // Intentionally ignored -- local cleanup proceeds regardless.
        }

        await convexManager.logout()
        KeychainHelper.deleteAll()
        isAuthenticated = false
        currentEmail = nil
    }

    // MARK: - Password Reset

    /// Request a password reset code sent to the given email.
    func requestPasswordReset(email: String) async {
        clearError()
        isLoading = true
        defer { isLoading = false }

        do {
            let _: SignInResult = try await convexManager.action(
                "auth:signIn",
                with: [
                    "provider": "password",
                    "params": [
                        "email": email,
                        "flow": "reset",
                    ] as [String: ConvexEncodable?],
                ]
            )
        } catch {
            self.error = parseError(error)
        }
    }

    /// Confirm a password reset using the OTP code and new password.
    func confirmPasswordReset(email: String, code: String, newPassword: String) async {
        clearError()
        isLoading = true
        defer { isLoading = false }

        do {
            let result: SignInResult = try await convexManager.action(
                "auth:signIn",
                with: [
                    "provider": "password",
                    "params": [
                        "email": email,
                        "code": code,
                        "newPassword": newPassword,
                        "flow": "reset-verification",
                    ] as [String: ConvexEncodable?],
                ]
            )
            try await handleTokenResult(result, email: email)
        } catch {
            self.error = parseError(error)
        }
    }

    // MARK: - Session Restore

    /// Attempt to restore a previous session from Keychain credentials.
    ///
    /// Call this once on app launch. Sets `isLoading = false` when complete,
    /// regardless of outcome.
    func restoreSession() async {
        isLoading = true
        defer { isLoading = false }

        guard KeychainHelper.read(key: KeychainHelper.Keys.jwt) != nil else {
            return
        }

        currentEmail = KeychainHelper.read(key: KeychainHelper.Keys.email)

        let result = await convexManager.loginFromCache()
        switch result {
        case .success:
            isAuthenticated = true
        case .failure:
            KeychainHelper.deleteAll()
            currentEmail = nil
            isAuthenticated = false
        }
    }

    // MARK: - Private Helpers

    private func handleTokenResult(_ result: SignInResult, email: String) async throws {
        guard let tokens = result.tokens else {
            throw AuthError.noStoredCredentials
        }

        KeychainHelper.save(key: KeychainHelper.Keys.jwt, value: tokens.token)
        KeychainHelper.save(key: KeychainHelper.Keys.refreshToken, value: tokens.refreshToken)
        KeychainHelper.save(key: KeychainHelper.Keys.email, value: email)

        await convexManager.login()
        isAuthenticated = true
        currentEmail = email
    }

    private func clearError() {
        error = nil
    }

    private func parseError(_ error: Error) -> String {
        if let authError = error as? AuthError {
            return authError.localizedDescription
        }
        let message = error.localizedDescription
        // Strip Convex wrapper prefixes for cleaner user-facing messages.
        if let range = message.range(of: "Uncaught Error: ") {
            return String(message[range.upperBound...])
        }
        return message
    }
}

// MARK: - SwiftUI Environment

private struct AuthManagerKey: EnvironmentKey {
    static let defaultValue = AuthManager()
}

extension EnvironmentValues {
    var authManager: AuthManager {
        get { self[AuthManagerKey.self] }
        set { self[AuthManagerKey.self] = newValue }
    }
}
