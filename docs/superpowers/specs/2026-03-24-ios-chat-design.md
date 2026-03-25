# AI Coach Chat - iOS Design Spec

## Overview

Add the AI Coach chat interface to the iOS app, replacing the Chat tab placeholder. Users converse with the AI coach, which can analyze their training data, program workouts, manage goals/injuries, and push workouts to Tonal. Messages stream in real-time via Convex subscriptions.

## Goals

- Real-time chat with streaming AI responses
- Tool call approval UI (workout pushes, week programming)
- Image upload support (progress photos)
- Markdown rendering for coach responses
- Week plan card rendering inline in chat
- Continuous conversation history across threads
- Same backend - no new Convex functions needed

## Architecture

### No Backend Changes

The iOS app calls the same mutations/queries/actions as the web:

| Function                      | Type     | Purpose                               |
| ----------------------------- | -------- | ------------------------------------- |
| `threads:getCurrentThread`    | query    | Get active thread (subscription)      |
| `chat:sendMessageMutation`    | mutation | Send user message (text + images)     |
| `chat:generateImageUploadUrl` | mutation | Get signed upload URL for images      |
| `chat:listMessages`           | query    | Paginated message list with streaming |
| `chat:respondToToolApproval`  | mutation | Approve/deny tool execution           |
| `chat:continueAfterApproval`  | action   | Resume agent after approval           |

### Message Format

Messages use `@convex-dev/agent`'s UIMessage format with parts:

- `text` - plain text content
- `file` - image with URL and mediaType
- `dynamic-tool` - tool call with state (input-streaming, approval-requested, output-available, etc.)

### Streaming

Messages stream via Convex subscription to `chat:listMessages`. The `@convex-dev/agent` saves stream deltas (word-level, 100ms throttle) which the subscription picks up in real-time.

## Components

### Swift Files to Create

| File                           | Purpose                                           |
| ------------------------------ | ------------------------------------------------- |
| `Chat/ChatModels.swift`        | Decodable types for messages, threads, tool calls |
| `Chat/ChatView.swift`          | Main chat screen with message list + input        |
| `Chat/ChatViewModel.swift`     | @Observable managing messages, sending, streaming |
| `Chat/MessageBubble.swift`     | User/coach message bubbles with markdown          |
| `Chat/ChatInput.swift`         | Text input with image attachment + send button    |
| `Chat/ToolApprovalCard.swift`  | Approve/deny card for tool calls                  |
| `Chat/ToolCallChip.swift`      | Status chip for tool execution                    |
| `Chat/ThinkingIndicator.swift` | Animated dots while coach is thinking             |
| `Chat/MarkdownText.swift`      | Markdown renderer for coach responses             |

### Swift Files to Modify

| File                    | Change                                     |
| ----------------------- | ------------------------------------------ |
| `App/ContentView.swift` | Replace Chat tab placeholder with ChatView |

## Screen Design

### ChatView (main screen)

- NavigationStack with "Coach" title
- Message list: ScrollView with LazyVStack
- Messages grouped by date (dividers between days)
- Auto-scroll to bottom on new messages
- Pull up to load earlier messages

**Message types rendered:**

- User bubble (right-aligned, primary color background)
- Coach bubble (left-aligned, card background, with avatar)
- Tool approval card (inline, with Approve/Deny buttons)
- Tool call chips (small status indicators)
- Thinking indicator (animated dots)

### ChatInput (bottom bar)

- TextField with placeholder "Message your coach..."
- Image attachment button (paperclip icon)
- Send button (arrow.up.circle.fill, disabled when empty)
- Image preview row (thumbnails with remove X)
- Max 4 images, 10MB each
- Keyboard-aware padding

### MessageBubble

**User messages (right-aligned):**

- Primary color background, rounded corners
- Text in primary foreground
- Images displayed as thumbnails (tappable for full-screen)
- Timestamp above first message in group

**Coach messages (left-aligned):**

- Card background, rounded corners
- Sparkle icon avatar
- Markdown-rendered text (headings, lists, bold, code, tables)
- Streaming: text appears word-by-word with cursor indicator
- Week plan blocks rendered as inline cards (if detected)

### ToolApprovalCard

- Card with descriptive label (e.g., "Push workouts to your Tonal")
- Two buttons: Approve (green checkmark) and Deny (red X)
- States: pending -> processing -> done
- On approve: calls `respondToToolApproval` then `continueAfterApproval`
- On deny: calls `respondToToolApproval` with approved=false

### ThinkingIndicator

- Coach avatar + "Coach" label
- Three pulsing dots with staggered animation
- Shown when waiting for first response after sending

## Data Types

```swift
// Thread
struct ChatThread: Decodable {
    let _id: String
    let userId: String?
}

// UIMessage from @convex-dev/agent
struct ChatMessage: Decodable, Identifiable {
    let key: String
    let _creationTime: Double
    let order: Double?
    let stepOrder: Double?
    let status: String?  // "pending", "streaming", "final"
    let role: String     // "user", "assistant"
    let text: String?
    let parts: [MessagePart]?
    var id: String { key }
    var isUser: Bool { role == "user" }
    var isAssistant: Bool { role == "assistant" }
    var isStreaming: Bool { status == "streaming" }
}

// Message parts (polymorphic)
struct MessagePart: Decodable {
    let type: String  // "text", "file", "dynamic-tool"
    // Text
    let text: String?
    // File
    let url: String?
    let mediaType: String?
    let filename: String?
    // Tool
    let toolCallId: String?
    let toolName: String?
    let input: AnyCodable?
    let state: String?  // "input-streaming", "approval-requested", "output-available", etc.
    let approval: ToolApproval?
}

struct ToolApproval: Decodable {
    let id: String
    let approved: Bool?
}

// Paginated message response
struct MessageListResponse: Decodable {
    let page: [ChatMessage]
    let isDone: Bool
    let continueCursor: String?
}
```

## Key Interactions

### Sending a Message

1. User types text, optionally attaches images
2. For each image: call `generateImageUploadUrl`, upload to returned URL, collect storage IDs
3. Call `sendMessageMutation` with text, threadId, imageStorageIds
4. Show optimistic user bubble immediately
5. Show thinking indicator
6. Subscribe to message stream - coach response appears word-by-word

### Tool Approval

1. Coach response includes a `dynamic-tool` part with `state: "approval-requested"`
2. Render ToolApprovalCard inline
3. User taps Approve/Deny
4. Call `respondToToolApproval` mutation
5. Call `continueAfterApproval` action
6. Agent continues execution, new message streams in

### Image Upload

1. User taps attachment button
2. PHPickerViewController for image selection (max 4)
3. Client-side validation (size, format)
4. Show thumbnails in preview row
5. On send: upload all -> collect storage IDs -> include in mutation

## Error Handling

| Scenario           | Handling                                      |
| ------------------ | --------------------------------------------- |
| Rate limit (burst) | Show "Slow down" error, disable input briefly |
| Rate limit (daily) | Show "Daily limit reached" with count         |
| Network error      | Show retry button on failed message           |
| Image too large    | Show "Image must be under 10MB"               |
| Too many images    | Show "Maximum 4 images per message"           |
| Streaming error    | Show error in coach bubble with retry         |

## Markdown Rendering

Use AttributedString for basic markdown (bold, italic, lists, headings, code, links). For v1, support:

- **Bold** and _italic_
- Headings (# ## ###)
- Bullet and numbered lists
- Inline `code` and code blocks
- Links (tappable, open in Safari)

Tables and complex markdown can render as plain text in v1.

## Testing

- Send text message -> coach responds with streaming
- Send image -> appears in bubble, coach acknowledges
- Tool approval -> approve -> agent continues
- Tool approval -> deny -> agent acknowledges denial
- Thinking indicator shows while waiting
- Auto-scroll to bottom on new messages
- Switch tabs and back -> messages persist
- Kill app, relaunch -> conversation history loads
