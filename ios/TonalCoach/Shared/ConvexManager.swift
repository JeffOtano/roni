import Combine
import ConvexMobile
import Foundation
import SwiftUI

/// Global ConvexClientWithAuth instance, created once at app launch.
///
/// Uses `PasswordAuthProvider` so the Convex client can authenticate
/// via email/password JWTs stored in the Keychain.
private let sharedAuthProvider = PasswordAuthProvider()

private let globalConvexClient: ConvexClientWithAuth<String> = {
    let url = Bundle.main.infoDictionary?["CONVEX_URL"] as? String
        ?? "https://quaint-bulldog-653.convex.cloud"
    let client = ConvexClientWithAuth(
        deploymentUrl: url,
        authProvider: sharedAuthProvider
    )
    // The auth provider needs a reference back to the client for token refresh.
    sharedAuthProvider.client = client
    return client
}()

/// Manager wrapping the global ConvexClientWithAuth for use throughout the app.
///
/// Uses `@Observable` (iOS 17+) so SwiftUI views automatically react to
/// state changes. Inject via the `.convexManager` environment value.
@Observable
final class ConvexManager {
    // MARK: - Client

    /// The underlying Convex client (global singleton, never deallocated).
    let client = globalConvexClient

    // MARK: - Connection State

    /// Whether the WebSocket connection to Convex is currently active.
    private(set) var isConnected = false

    // MARK: - Auth

    /// Publisher that emits the current authentication state.
    var authState: AnyPublisher<AuthState<String>, Never> {
        client.authState
    }

    /// Trigger a login flow using credentials already stored in the Keychain.
    ///
    /// Call this after saving a JWT via `KeychainHelper` (e.g. after a
    /// successful sign-in API call). Sets `authState` to `.loading`,
    /// then `.authenticated` or `.unauthenticated`.
    @discardableResult
    func login() async -> Result<String, Error> {
        await client.login()
    }

    /// Attempt a silent re-authentication using a stored refresh token.
    ///
    /// Typically called at app launch. If no valid refresh token exists,
    /// the result is `.unauthenticated` without user-visible error.
    @discardableResult
    func loginFromCache() async -> Result<String, Error> {
        await client.loginFromCache()
    }

    /// Log out, clearing Keychain credentials and resetting auth state.
    func logout() async {
        await client.logout()
    }

    // MARK: - Private

    private var cancellables = Set<AnyCancellable>()

    // MARK: - Init

    init() {
        client.watchWebSocketState()
            .receive(on: DispatchQueue.main)
            .sink { [weak self] state in
                self?.isConnected = state == .connected
            }
            .store(in: &cancellables)
    }

    // MARK: - Subscriptions

    /// Subscribe to a Convex query and receive updates as a Combine publisher.
    ///
    /// - Parameters:
    ///   - name: Query path in "module:functionName" format.
    ///   - args: Optional dictionary of arguments.
    /// - Returns: A publisher that emits decoded values of type `T` whenever the query result changes.
    func subscribe<T: Decodable>(
        to name: String,
        with args: [String: ConvexEncodable?]? = nil
    ) -> AnyPublisher<T, ClientError> {
        client.subscribe(to: name, with: args, yielding: T.self)
    }

    /// Subscribe to a Convex query and expose results as an `AsyncStream`.
    ///
    /// Wraps the Combine publisher in an `AsyncStream` for use in `for await` loops
    /// and SwiftUI `.task` modifiers. The subscription is automatically canceled
    /// when the stream's consumer stops iterating.
    ///
    /// - Parameters:
    ///   - name: Query path in "module:functionName" format.
    ///   - args: Optional dictionary of arguments.
    /// - Returns: An `AsyncStream` that yields decoded values of type `T`.
    func stream<T: Decodable>(
        _ name: String,
        with args: [String: ConvexEncodable?]? = nil
    ) -> AsyncStream<T> {
        let publisher: AnyPublisher<T, ClientError> = client.subscribe(
            to: name, with: args, yielding: T.self)
        return AsyncStream { continuation in
            let cancellable = publisher
                .sink(
                    receiveCompletion: { completion in
                        switch completion {
                        case .finished:
                            continuation.finish()
                        case .failure:
                            continuation.finish()
                        }
                    },
                    receiveValue: { value in
                        continuation.yield(value)
                    }
                )
            continuation.onTermination = { _ in
                cancellable.cancel()
            }
        }
    }

    // MARK: - One-Shot Queries

    /// Execute a one-shot Convex query and return the decoded result.
    ///
    /// This fetches the current value once (no live subscription). Useful for
    /// paginated queries and imperative data loads in `.task` modifiers.
    ///
    /// Under the hood, subscribes to the query, takes the first emitted value,
    /// and cancels the subscription.
    ///
    /// - Parameters:
    ///   - name: Query path in "module:functionName" format.
    ///   - args: Optional dictionary of arguments.
    /// - Returns: The decoded result of type `T`.
    func query<T: Decodable>(
        _ name: String,
        args: [String: ConvexEncodable?]? = nil
    ) async throws -> T {

        // Use the documented .values async sequence pattern from Convex Swift docs.
        let publisher = client.subscribe(to: name, with: args, yielding: T.self)

        // Race the subscription against a timeout
        return try await withThrowingTaskGroup(of: T.self) { group in
            group.addTask {
                for try await value in publisher.values {
                    return value
                }
                throw ClientError.InternalError(msg: "Query \(name) completed without emitting a value")
            }

            group.addTask {
                try await Task.sleep(nanoseconds: 15_000_000_000) // 15 second timeout
                throw ClientError.InternalError(msg: "Query \(name) timed out after 15s - check WebSocket connection")
            }

            // Return whichever finishes first
            let result = try await group.next()!
            group.cancelAll()
            return result
        }
    }

    // MARK: - Mutations

    /// Execute a Convex mutation that returns a decoded result.
    ///
    /// - Parameters:
    ///   - name: Mutation path in "module:mutationName" format.
    ///   - args: Optional dictionary of arguments.
    /// - Returns: The decoded result of type `T`.
    func mutation<T: Decodable>(
        _ name: String,
        with args: [String: ConvexEncodable?]? = nil
    ) async throws -> T {
        try await client.mutation(name, with: args)
    }

    /// Execute a Convex mutation that does not return a value.
    ///
    /// - Parameters:
    ///   - name: Mutation path in "module:mutationName" format.
    ///   - args: Optional dictionary of arguments.
    func mutation(
        _ name: String,
        with args: [String: ConvexEncodable?]? = nil
    ) async throws {
        try await client.mutation(name, with: args)
    }

    // MARK: - Actions

    /// Execute a Convex action that returns a decoded result.
    ///
    /// - Parameters:
    ///   - name: Action path in "module:actionName" format.
    ///   - args: Optional dictionary of arguments.
    /// - Returns: The decoded result of type `T`.
    func action<T: Decodable>(
        _ name: String,
        with args: [String: ConvexEncodable?]? = nil
    ) async throws -> T {
        try await client.action(name, with: args)
    }

    /// Execute a Convex action that does not return a value.
    ///
    /// - Parameters:
    ///   - name: Action path in "module:actionName" format.
    ///   - args: Optional dictionary of arguments.
    func action(
        _ name: String,
        with args: [String: ConvexEncodable?]? = nil
    ) async throws {
        try await client.action(name, with: args)
    }
}

// MARK: - SwiftUI Environment

/// Environment key for injecting `ConvexManager` into the SwiftUI view hierarchy.
private struct ConvexManagerKey: EnvironmentKey {
    static let defaultValue = ConvexManager()
}

extension EnvironmentValues {
    var convexManager: ConvexManager {
        get { self[ConvexManagerKey.self] }
        set { self[ConvexManagerKey.self] = newValue }
    }
}
