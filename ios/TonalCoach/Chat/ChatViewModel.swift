import Combine
import ConvexMobile
import Foundation
import SwiftUI

// MARK: - Chat View Model

/// Manages all chat state and operations for the AI Coach.
///
/// Key responsibilities:
/// - Subscribe to `threads:getCurrentThread` for active thread
/// - Subscribe to `chat:listMessages` for real-time message stream
/// - Send messages via `chat:sendMessage` (creates thread) or `chat:sendMessageMutation`
/// - Handle tool approvals via `chat:respondToToolApproval` + `chat:continueAfterApproval`
/// - Image upload via `chat:generateImageUploadUrl`
@Observable
final class ChatViewModel {
    // MARK: - State

    var messages: [ChatMessage] = []
    var currentThreadId: String?
    var isSending = false
    var isLoadingMessages = false
    var error: String?

    // Image attachments
    var pendingImages: [PendingImage] = []
    var isUploadingImages = false

    // MARK: - Pending Image

    struct PendingImage: Identifiable {
        let id = UUID()
        let data: Data
        let preview: UIImage
    }

    // MARK: - Private

    private var threadCancellable: AnyCancellable?
    private var messageCancellable: AnyCancellable?

    // MARK: - Thread Subscription

    /// Subscribe to `threads:getCurrentThread` for the active thread.
    /// When a thread is found, automatically subscribes to its messages.
    func subscribeToThread(using manager: ConvexManager) {
        threadCancellable?.cancel()

        threadCancellable = manager.client
            .subscribe(to: "threads:getCurrentThread", yielding: ChatThread?.self)
            .receive(on: DispatchQueue.main)
            .sink(
                receiveCompletion: { _ in },
                receiveValue: { [weak self] thread in
                    guard let self else { return }
                    let newId = thread?.threadId
                    if newId != self.currentThreadId {
                        self.currentThreadId = newId
                        if let threadId = newId {
                            self.subscribeToMessages(threadId: threadId, using: manager)
                        }
                    }
                }
            )
    }

    // MARK: - Message Subscription

    /// Subscribe to `chat:listMessages` for real-time message streaming.
    /// The @convex-dev/agent query returns paginated UIMessages with streaming state.
    private func subscribeToMessages(threadId: String, using manager: ConvexManager) {
        isLoadingMessages = true
        messageCancellable?.cancel()

        // listMessages requires: threadId, paginationOpts, streamArgs
        // numItems must be Double (Convex v.float64)
        let args: [String: ConvexEncodable?] = [
            "threadId": threadId,
            "paginationOpts": [
                "numItems": Double(50),
                "cursor": nil as String?,
            ] as [String: ConvexEncodable?],
            "streamArgs": [
                "kind": "list",
            ] as [String: ConvexEncodable?],
        ]

        messageCancellable = manager.client
            .subscribe(to: "chat:listMessages", with: args, yielding: MessageListResponse.self)
            .receive(on: DispatchQueue.main)
            .sink(
                receiveCompletion: { [weak self] _ in
                    self?.isLoadingMessages = false
                },
                receiveValue: { [weak self] response in
                    guard let self else { return }
                    self.messages = response.page
                        .filter { $0.hasContent }
                        .sorted { $0.sortKey < $1.sortKey }
                    self.isLoadingMessages = false
                }
            )
    }

    // MARK: - Send Message

    /// Send a text message (with optional images) to the coach.
    ///
    /// - When no thread exists: uses `chat:sendMessage` action (creates thread automatically).
    /// - When a thread exists: uses `chat:sendMessageMutation` mutation (faster, schedules processing).
    func send(text: String, using manager: ConvexManager) async {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        isSending = true
        error = nil

        do {
            // Upload images if any
            var imageStorageIds: [String] = []
            if !pendingImages.isEmpty {
                isUploadingImages = true
                imageStorageIds = try await uploadImages(using: manager)
                isUploadingImages = false
            }

            if let threadId = currentThreadId {
                // Existing thread: use the fast mutation path
                var args: [String: ConvexEncodable?] = [
                    "prompt": trimmed,
                    "threadId": threadId,
                ]
                if !imageStorageIds.isEmpty {
                    args["imageStorageIds"] = imageStorageIds.map { $0 as ConvexEncodable? }
                }

                let _: SendMessageResult = try await manager.mutation(
                    "chat:sendMessageMutation", with: args
                )
            } else {
                // No thread: use the action that auto-creates one
                var args: [String: ConvexEncodable?] = [
                    "prompt": trimmed,
                ]
                if !imageStorageIds.isEmpty {
                    args["imageStorageIds"] = imageStorageIds.map { $0 as ConvexEncodable? }
                }

                let result: SendMessageResult = try await manager.action(
                    "chat:sendMessage", with: args
                )
                // Thread subscription will pick up the new thread,
                // but set it eagerly so the UI updates immediately.
                currentThreadId = result.threadId
                subscribeToMessages(threadId: result.threadId, using: manager)
            }

            pendingImages.removeAll()
        } catch {
            self.error = parseError(error)
        }

        isUploadingImages = false
        isSending = false
    }

    // MARK: - Tool Approval

    /// Respond to a tool approval request and continue agent execution.
    func respondToApproval(
        approvalId: String,
        approved: Bool,
        using manager: ConvexManager
    ) async {
        guard let threadId = currentThreadId else { return }

        do {
            // Step 1: Record the approval/denial
            let result: ToolApprovalResult = try await manager.mutation(
                "chat:respondToToolApproval",
                with: [
                    "threadId": threadId,
                    "approvalId": approvalId,
                    "approved": approved,
                ]
            )

            // Step 2: Continue agent execution
            try await manager.action(
                "chat:continueAfterApproval",
                with: [
                    "threadId": threadId,
                    "messageId": result.messageId,
                ]
            )
        } catch {
            self.error = "Failed to process approval"
        }
    }

    // MARK: - Image Management

    /// Add an image from raw data. Validates size and count limits.
    func addImage(_ data: Data) {
        guard pendingImages.count < 4 else {
            error = "Maximum 4 images per message"
            return
        }
        guard data.count <= 10_000_000 else {
            error = "Image must be under 10MB"
            return
        }
        guard let image = UIImage(data: data) else {
            error = "Could not read image"
            return
        }
        pendingImages.append(PendingImage(data: data, preview: image))
    }

    /// Remove a pending image at the given index.
    func removeImage(at index: Int) {
        guard pendingImages.indices.contains(index) else { return }
        pendingImages.remove(at: index)
    }

    // MARK: - Image Upload

    /// Upload all pending images to Convex storage.
    /// Returns an array of storage IDs for use in the send mutation.
    private func uploadImages(using manager: ConvexManager) async throws -> [String] {
        var storageIds: [String] = []

        for image in pendingImages {
            // Get a signed upload URL from Convex
            let urlResult: UploadUrlResult = try await manager.mutation(
                "chat:generateImageUploadUrl", with: [:]
            )

            guard let url = URL(string: urlResult.uploadUrl) else {
                throw ChatError.uploadFailed("Invalid upload URL")
            }

            // POST the image data to the upload URL
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("image/jpeg", forHTTPHeaderField: "Content-Type")
            request.httpBody = image.data

            let (responseData, response) = try await URLSession.shared.data(for: request)
            guard let httpResponse = response as? HTTPURLResponse,
                  httpResponse.statusCode == 200
            else {
                throw ChatError.uploadFailed("Upload returned non-200 status")
            }

            // Parse the storage ID from the JSON response body
            let uploadResponse = try JSONDecoder().decode(UploadResponse.self, from: responseData)
            storageIds.append(uploadResponse.storageId)
        }

        return storageIds
    }

    // MARK: - Cleanup

    /// Cancel all active subscriptions. Call when the view disappears.
    func cleanup() {
        threadCancellable?.cancel()
        messageCancellable?.cancel()
        threadCancellable = nil
        messageCancellable = nil
    }

    // MARK: - Error Parsing

    private func parseError(_ error: Error) -> String {
        let msg = error.localizedDescription.lowercased()
        if msg.contains("dailymessages") || msg.contains("daily") {
            return "Daily message limit reached. Try again tomorrow."
        }
        if msg.contains("rate") || msg.contains("limit") {
            return "Slow down! Wait a moment before sending."
        }
        if msg.contains("network") || msg.contains("connection") {
            return "Connection error. Check your internet."
        }
        if msg.contains("upload") {
            return "Image upload failed. Please try again."
        }
        return "Something went wrong. Try again."
    }
}

// MARK: - Chat Error

private enum ChatError: LocalizedError {
    case uploadFailed(String)

    var errorDescription: String? {
        switch self {
        case .uploadFailed(let reason): return "Upload failed: \(reason)"
        }
    }
}
