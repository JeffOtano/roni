import Foundation

// MARK: - Thread

/// Active thread response from `threads:getCurrentThread`.
/// Returns nil when no active thread exists for the user.
struct ChatThread: Decodable {
    let threadId: String
    let lastMessageTime: Double
}

// MARK: - Message

/// UIMessage format from @convex-dev/agent.
/// Messages have a `parts` array that can contain text, files, and tool calls.
struct ChatMessage: Decodable, Identifiable {
    let key: String
    let _creationTime: Double
    let order: Double?
    let stepOrder: Double?
    let status: String? // "pending", "streaming", "final"
    let role: String // "user", "assistant"
    let text: String?
    let parts: [MessagePart]?

    var id: String { key }
    var isUser: Bool { role == "user" }
    var isAssistant: Bool { role == "assistant" }
    var isStreaming: Bool { status == "streaming" }

    /// Extract all text from parts, falling back to top-level text.
    var displayText: String {
        if let parts, !parts.isEmpty {
            let textParts = parts.compactMap { $0.type == "text" ? $0.text : nil }
            if !textParts.isEmpty {
                return textParts.joined()
            }
        }
        return text ?? ""
    }

    /// Extract image URLs from file parts.
    var imageUrls: [String] {
        parts?.compactMap { $0.type == "file" ? $0.url : nil } ?? []
    }

    /// Extract tool call parts.
    var toolCalls: [MessagePart] {
        parts?.filter { $0.type == "dynamic-tool" } ?? []
    }

    /// Whether this message has any visible content (text or images).
    var hasContent: Bool {
        !displayText.isEmpty || !imageUrls.isEmpty || !toolCalls.isEmpty
    }

    /// Creation date for grouping.
    var creationDate: Date {
        Date(timeIntervalSince1970: _creationTime / 1000)
    }

    /// Sort key: prefer order (assigned by agent), fall back to creation time.
    var sortKey: Double {
        order ?? _creationTime
    }
}

// MARK: - Message Part

/// Polymorphic message part -- can be text, file, or tool call.
/// Uses optional properties since the shape varies by type.
struct MessagePart: Decodable, Identifiable {
    let type: String // "text", "file", "dynamic-tool"

    // Text part
    let text: String?

    // File part
    let url: String?
    let mediaType: String?
    let filename: String?

    // Tool part
    let toolCallId: String?
    let toolName: String?
    let state: String?
    // "input-streaming", "input-available", "output-available",
    // "approval-requested", "approval-responded", "output-denied"
    let approval: ToolApproval?

    var id: String {
        toolCallId ?? url ?? text ?? UUID().uuidString
    }

    var isApprovalRequested: Bool {
        type == "dynamic-tool" && state == "approval-requested"
    }

    var isApprovalResponded: Bool {
        type == "dynamic-tool" && state == "approval-responded"
    }

    var isToolRunning: Bool {
        type == "dynamic-tool" && (state == "input-streaming" || state == "input-available")
    }

    var isToolDone: Bool {
        type == "dynamic-tool" && state == "output-available"
    }

    /// Human-readable label for a tool call.
    var toolLabel: String {
        switch toolName {
        case "create_workout": return "Creating workout"
        case "program_week": return "Programming your week"
        case "approve_week_plan": return "Push workouts to Tonal"
        case "delete_workout": return "Delete workout"
        case "delete_week_plan": return "Delete week plan"
        case "search_exercises": return "Searching exercises"
        case "get_strength_scores": return "Checking strength scores"
        case "get_muscle_readiness": return "Checking muscle readiness"
        case "get_workout_history": return "Reviewing workout history"
        case "get_workout_detail": return "Analyzing workout"
        case "get_training_frequency": return "Checking training frequency"
        case "get_strength_history": return "Loading strength history"
        case "estimate_duration": return "Estimating duration"
        case "record_feedback": return "Recording feedback"
        case "set_goal": return "Setting goal"
        case "report_injury": return "Recording injury"
        case "resolve_injury": return "Resolving injury"
        case "get_goals": return "Checking goals"
        case "get_injuries": return "Checking injuries"
        case "swap_exercise": return "Swapping exercise"
        case "add_exercise": return "Adding exercise"
        case "move_session": return "Moving session"
        default: return toolName ?? "Processing"
        }
    }
}

// MARK: - Tool Approval

struct ToolApproval: Decodable {
    let id: String
    let approved: Bool?
}

// MARK: - Send Message Result

/// Response from `chat:sendMessage` action (handles thread creation)
/// and `chat:sendMessageMutation` mutation.
struct SendMessageResult: Decodable {
    let threadId: String
}

// MARK: - Create Thread Result

/// Response from `chat:createThread` mutation.
struct CreateThreadResult: Decodable {
    let threadId: String
}

// MARK: - Upload URL Result

/// Response from `chat:generateImageUploadUrl` mutation.
struct UploadUrlResult: Decodable {
    let uploadUrl: String
}

// MARK: - Upload Response

/// Response body from POSTing image data to a Convex upload URL.
struct UploadResponse: Decodable {
    let storageId: String
}

// MARK: - Tool Approval Response

/// Response from `chat:respondToToolApproval` mutation.
struct ToolApprovalResult: Decodable {
    let messageId: String
}

// MARK: - Message List Response

/// Paginated message list from `chat:listMessages`.
/// Includes streaming state alongside the standard pagination shape.
struct MessageListResponse: Decodable {
    let page: [ChatMessage]
    let isDone: Bool
    let continueCursor: String
}
