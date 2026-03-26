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
            ForEach(Array(suggestions.enumerated()), id: \.element) { chipIndex, suggestion in
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
                .staggeredAppear(index: chipIndex, interval: Animate.chipStagger)
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

                            ForEach(Array(group.messages.enumerated()), id: \.element.id) { index, message in
                                let previous = index > 0 ? group.messages[index - 1] : nil
                                let grouped = isGroupedWithPrevious(message, previous: previous)
                                MessageBubble(
                                    message: message,
                                    isGroupedWithPrevious: grouped
                                ) { approvalId, approved in
                                    Task {
                                        await viewModel.respondToApproval(
                                            approvalId: approvalId,
                                            approved: approved,
                                            using: convex
                                        )
                                    }
                                }
                                .padding(.top, grouped ? 4 : 12)
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
                .scrollDismissesKeyboard(.immediately)
            }

            // Error banner
            if let error = viewModel.error {
                errorBanner(error)
            }

            ChatInputBar(viewModel: viewModel)
        }
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

    // MARK: - Thinking Indicator State

    private var showThinkingIndicator: Bool {
        guard viewModel.isSending else { return false }
        guard let last = viewModel.messages.last else { return true }
        return last.isUser
    }

    // MARK: - Message Grouping

    private func isGroupedWithPrevious(_ message: ChatMessage, previous: ChatMessage?) -> Bool {
        guard let prev = previous else { return false }
        guard message.role == prev.role else { return false }
        let timeDiff = abs(message._creationTime - prev._creationTime)
        return timeDiff < 120_000
    }

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

    // MARK: - Actions

    private func sendSuggestion(_ text: String) {
        Task {
            await viewModel.send(text: text, using: convex)
        }
    }
}
