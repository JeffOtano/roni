import SwiftUI

// MARK: - Chat View

/// Main chat screen for the AI training coach.
///
/// Replaces the "Coming Soon" placeholder on the Chat tab.
/// Manages three states: loading, empty (welcome + suggestions), and active (message list).
struct ChatView: View {
    @Environment(\.convexManager) private var convex
    @State private var viewModel = ChatViewModel()

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.Colors.background
                    .ignoresSafeArea()

                Group {
                    if viewModel.isLoadingMessages && viewModel.messages.isEmpty {
                        loadingView
                    } else if viewModel.messages.isEmpty && viewModel.currentThreadId == nil {
                        emptyStateView
                    } else {
                        chatContentView
                    }
                }
            }
            .navigationTitle("Coach")
            .navigationBarTitleDisplayMode(.inline)
            .onAppear {
                viewModel.subscribeToThread(using: convex)
            }
            .onDisappear {
                viewModel.cleanup()
            }
        }
    }

    // MARK: - Loading

    private var loadingView: some View {
        ProgressView()
            .tint(Theme.Colors.primary)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Empty State

    private var emptyStateView: some View {
        VStack(spacing: 0) {
            Spacer()

            VStack(spacing: Theme.Spacing.lg) {
                // Coach avatar matching ThinkingIndicator's gradient style
                coachAvatar(size: 56, iconSize: 24)

                VStack(spacing: Theme.Spacing.sm) {
                    Text("tonal.coach")
                        .font(Theme.Typography.title2)
                        .foregroundStyle(Theme.Colors.textPrimary)

                    Text("Hi! I'm your AI training coach.")
                        .font(Theme.Typography.body)
                        .foregroundStyle(Theme.Colors.textSecondary)
                }

                // Suggestion chips
                suggestionChips
            }
            .padding(.horizontal, Theme.Spacing.xl)

            Spacer()

            ChatInputBar(viewModel: viewModel)
        }
    }

    private var suggestionChips: some View {
        let suggestions = [
            "Program my week",
            "Analyze my training",
            "Create a workout",
            "Check my recovery",
        ]

        return LazyVGrid(
            columns: [
                GridItem(.flexible(), spacing: Theme.Spacing.sm),
                GridItem(.flexible(), spacing: Theme.Spacing.sm),
            ],
            spacing: Theme.Spacing.sm
        ) {
            ForEach(suggestions, id: \.self) { suggestion in
                Button {
                    sendSuggestion(suggestion)
                } label: {
                    Text(suggestion)
                        .font(Theme.Typography.calloutMedium)
                        .foregroundStyle(Theme.Colors.textPrimary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, Theme.Spacing.md)
                        .padding(.horizontal, Theme.Spacing.sm)
                        .background(Theme.Colors.card)
                        .clipShape(
                            RoundedRectangle(
                                cornerRadius: Theme.CornerRadius.lg,
                                style: .continuous
                            )
                        )
                        .overlay(
                            RoundedRectangle(
                                cornerRadius: Theme.CornerRadius.lg,
                                style: .continuous
                            )
                            .stroke(Theme.Colors.border, lineWidth: 1)
                        )
                }
                .accessibilityHint("Send this message to your coach")
            }
        }
        .padding(.top, Theme.Spacing.sm)
    }

    // MARK: - Active Chat

    private var chatContentView: some View {
        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: Theme.Spacing.xs) {
                        ForEach(groupedMessages, id: \.label) { group in
                            dateDivider(group.label)

                            ForEach(group.messages) { message in
                                messageBubble(for: message)
                                    .id(message.id)
                            }
                        }

                        if showThinkingIndicator {
                            ThinkingIndicator()
                                .id("thinking")
                        }

                        // Bottom anchor for auto-scroll
                        Color.clear
                            .frame(height: 1)
                            .id("bottom")
                    }
                    .padding(.horizontal, Theme.Spacing.md)
                    .padding(.vertical, Theme.Spacing.sm)
                }
                .onChange(of: viewModel.messages.count) { _, _ in
                    withAnimation(.easeOut(duration: 0.3)) {
                        proxy.scrollTo("bottom", anchor: .bottom)
                    }
                }
                .onChange(of: showThinkingIndicator) { _, isThinking in
                    if isThinking {
                        withAnimation(.easeOut(duration: 0.3)) {
                            proxy.scrollTo("bottom", anchor: .bottom)
                        }
                    }
                }
                .onAppear {
                    proxy.scrollTo("bottom", anchor: .bottom)
                }
            }

            // Error banner
            if let error = viewModel.error {
                errorBanner(error)
            }

            ChatInputBar(viewModel: viewModel)
        }
    }

    // MARK: - Message Bubble

    @ViewBuilder
    private func messageBubble(for message: ChatMessage) -> some View {
        VStack(
            alignment: message.isUser ? .trailing : .leading,
            spacing: Theme.Spacing.xs
        ) {
            // Text content
            if !message.displayText.isEmpty {
                if message.isUser {
                    UserBubble(text: message.displayText)
                } else {
                    CoachBubble(
                        text: message.displayText,
                        isStreaming: message.isStreaming
                    )
                }
            }

            // Image attachments
            if !message.imageUrls.isEmpty {
                ImageAttachmentRow(urls: message.imageUrls)
            }

            // Tool calls
            ForEach(message.toolCalls) { part in
                if part.isApprovalRequested {
                    ToolApprovalCard(part: part) { approved in
                        guard let approvalId = part.approval?.id else { return }
                        Task {
                            await viewModel.respondToApproval(
                                approvalId: approvalId,
                                approved: approved,
                                using: convex
                            )
                        }
                    }
                } else {
                    ToolCallChip(part: part)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: message.isUser ? .trailing : .leading)
        .padding(.vertical, Theme.Spacing.xs)
    }

    // MARK: - Date Divider

    private func dateDivider(_ label: String) -> some View {
        HStack {
            Rectangle()
                .fill(Theme.Colors.border)
                .frame(height: 0.5)
            Text(label)
                .font(Theme.Typography.caption)
                .foregroundStyle(Theme.Colors.textTertiary)
                .layoutPriority(1)
            Rectangle()
                .fill(Theme.Colors.border)
                .frame(height: 0.5)
        }
        .padding(.vertical, Theme.Spacing.sm)
        .accessibilityLabel("Messages from \(label)")
    }

    // MARK: - Error Banner

    private func errorBanner(_ message: String) -> some View {
        HStack(spacing: Theme.Spacing.sm) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(Theme.Colors.destructive)
                .accessibilityHidden(true)
            Text(message)
                .font(Theme.Typography.caption)
                .foregroundStyle(Theme.Colors.destructive)
        }
        .padding(.horizontal, Theme.Spacing.md)
        .padding(.vertical, Theme.Spacing.sm)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Colors.destructive.opacity(0.1))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Error: \(message)")
    }

    // MARK: - Thinking Indicator State

    private var showThinkingIndicator: Bool {
        guard viewModel.isSending else { return false }
        guard let last = viewModel.messages.last else { return true }
        return last.isUser
    }

    // MARK: - Message Grouping

    private struct MessageGroup {
        let label: String
        let messages: [ChatMessage]
    }

    private var groupedMessages: [MessageGroup] {
        let calendar = Calendar.current
        var groups: [MessageGroup] = []
        var currentLabel = ""
        var currentMessages: [ChatMessage] = []

        for message in viewModel.messages {
            let label = dateLabel(for: message.creationDate, calendar: calendar)
            if label != currentLabel {
                if !currentMessages.isEmpty {
                    groups.append(MessageGroup(label: currentLabel, messages: currentMessages))
                }
                currentLabel = label
                currentMessages = [message]
            } else {
                currentMessages.append(message)
            }
        }

        if !currentMessages.isEmpty {
            groups.append(MessageGroup(label: currentLabel, messages: currentMessages))
        }

        return groups
    }

    private func dateLabel(for date: Date, calendar: Calendar) -> String {
        if calendar.isDateInToday(date) {
            return "Today"
        } else if calendar.isDateInYesterday(date) {
            return "Yesterday"
        } else {
            let formatter = DateFormatter()
            formatter.dateFormat = "MMM d"
            return formatter.string(from: date)
        }
    }

    // MARK: - Coach Avatar

    private func coachAvatar(size: CGFloat, iconSize: CGFloat) -> some View {
        ZStack {
            Circle()
                .fill(
                    LinearGradient(
                        colors: [Theme.Colors.primary, Color(hex: "9754ed")],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    )
                )
                .frame(width: size, height: size)
            Image(systemName: "sparkles")
                .font(.system(size: iconSize, weight: .semibold))
                .foregroundStyle(.white)
        }
        .accessibilityHidden(true)
    }

    // MARK: - Actions

    private func sendSuggestion(_ text: String) {
        Task {
            await viewModel.send(text: text, using: convex)
        }
    }
}

// MARK: - User Bubble

/// Right-aligned bubble for user messages with a chat-tail shape.
private struct UserBubble: View {
    let text: String

    var body: some View {
        Text(text)
            .font(Theme.Typography.body)
            .foregroundStyle(Theme.Colors.primaryForeground)
            .padding(.horizontal, Theme.Spacing.md)
            .padding(.vertical, Theme.Spacing.sm)
            .background(Theme.Colors.primary)
            .clipShape(
                UnevenRoundedRectangle(
                    topLeadingRadius: 16,
                    bottomLeadingRadius: 16,
                    bottomTrailingRadius: 8,
                    topTrailingRadius: 16,
                    style: .continuous
                )
            )
            .accessibilityLabel("You said: \(text)")
    }
}

// MARK: - Coach Bubble

/// Left-aligned bubble for assistant messages with markdown rendering and avatar.
private struct CoachBubble: View {
    let text: String
    var isStreaming: Bool = false

    var body: some View {
        HStack(alignment: .top, spacing: Theme.Spacing.sm) {
            // Coach avatar matching ThinkingIndicator style
            ZStack {
                Circle()
                    .fill(
                        LinearGradient(
                            colors: [Theme.Colors.primary, Color(hex: "9754ed")],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 28, height: 28)
                Image(systemName: "sparkles")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.white)
            }
            .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 0) {
                MarkdownText(content: text)
                    .textSelection(.enabled)

                if isStreaming {
                    streamingDots
                }
            }
            .padding(.horizontal, Theme.Spacing.md)
            .padding(.vertical, Theme.Spacing.sm)
            .background(Theme.Colors.card)
            .clipShape(bubbleShape)
            .overlay(bubbleShape.stroke(Theme.Colors.border, lineWidth: 1))
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Coach said: \(text)")
    }

    private var streamingDots: some View {
        HStack(spacing: 2) {
            ForEach(0..<3, id: \.self) { _ in
                Circle()
                    .fill(Theme.Colors.textTertiary)
                    .frame(width: 3, height: 3)
                    .opacity(0.6)
            }
        }
        .padding(.top, Theme.Spacing.xs)
        .accessibilityLabel("Still typing")
    }

    private var bubbleShape: UnevenRoundedRectangle {
        UnevenRoundedRectangle(
            topLeadingRadius: 16,
            bottomLeadingRadius: 8,
            bottomTrailingRadius: 16,
            topTrailingRadius: 16,
            style: .continuous
        )
    }
}

// MARK: - Image Attachment Row

/// Displays image attachments from a message as async-loaded thumbnails.
private struct ImageAttachmentRow: View {
    let urls: [String]

    var body: some View {
        HStack(spacing: Theme.Spacing.sm) {
            ForEach(urls, id: \.self) { urlString in
                if let url = URL(string: urlString) {
                    AsyncImage(url: url) { phase in
                        switch phase {
                        case .success(let image):
                            image
                                .resizable()
                                .aspectRatio(contentMode: .fill)
                                .frame(width: 120, height: 120)
                                .clipShape(
                                    RoundedRectangle(
                                        cornerRadius: Theme.CornerRadius.md,
                                        style: .continuous
                                    )
                                )
                        case .failure:
                            imagePlaceholder(icon: "photo.badge.exclamationmark")
                        case .empty:
                            imagePlaceholder(icon: "photo")
                                .overlay(ProgressView().tint(Theme.Colors.textTertiary))
                        @unknown default:
                            imagePlaceholder(icon: "photo")
                        }
                    }
                    .accessibilityLabel("Attached image")
                }
            }
        }
    }

    private func imagePlaceholder(icon: String) -> some View {
        RoundedRectangle(cornerRadius: Theme.CornerRadius.md, style: .continuous)
            .fill(Theme.Colors.muted)
            .frame(width: 120, height: 120)
            .overlay(
                Image(systemName: icon)
                    .foregroundStyle(Theme.Colors.textTertiary)
            )
    }
}

