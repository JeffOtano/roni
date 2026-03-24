import ConvexMobile
import Foundation

struct SignInResult: Decodable {
    let tokens: TokenPair?
    let signingIn: Bool?
}

struct TokenPair: Decodable {
    let token: String
    let refreshToken: String
}

final class PasswordAuthProvider: AuthProvider {
    typealias T = String

    /// Set after initialization once the ConvexClient is available.
    var client: ConvexClient?

    func login(onIdToken: @Sendable @escaping (String?) -> Void) async throws -> String {
        guard let jwt = KeychainHelper.read(key: KeychainHelper.Keys.jwt) else {
            throw AuthError.noStoredCredentials
        }
        onIdToken(jwt)
        return jwt
    }

    func loginFromCache(onIdToken: @Sendable @escaping (String?) -> Void) async throws -> String {
        guard let refreshToken = KeychainHelper.read(key: KeychainHelper.Keys.refreshToken) else {
            throw AuthError.noStoredCredentials
        }
        guard let client else {
            throw AuthError.clientNotSet
        }

        let result: SignInResult = try await client.action(
            "auth:signIn",
            with: ["refreshToken": refreshToken]
        )

        guard let tokens = result.tokens else {
            KeychainHelper.deleteAll()
            throw AuthError.refreshFailed
        }

        KeychainHelper.save(key: KeychainHelper.Keys.jwt, value: tokens.token)
        KeychainHelper.save(key: KeychainHelper.Keys.refreshToken, value: tokens.refreshToken)

        onIdToken(tokens.token)
        return tokens.token
    }

    func logout() async throws {
        KeychainHelper.deleteAll()
    }

    func extractIdToken(from authResult: String) -> String {
        authResult
    }
}

enum AuthError: LocalizedError {
    case noStoredCredentials
    case clientNotSet
    case refreshFailed

    var errorDescription: String? {
        switch self {
        case .noStoredCredentials:
            "No stored credentials found"
        case .clientNotSet:
            "ConvexClient reference not set on auth provider"
        case .refreshFailed:
            "Token refresh failed"
        }
    }
}
