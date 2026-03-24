import SwiftUI

// MARK: - Message Bubble

/// Renders a single ChatMessage as either a user or coach bubble.
///
/// - **User bubble**: right-aligned, teal background, plain text + image thumbnails.
/// - **Coach bubble**: left-aligned with sparkles avatar, card background, markdown text,
///   streaming cursor, and inline tool call indicators.
struct MessageBubble: View {
    let message: ChatMessage
    let onApprovalResponse: (String, Bool) -> Void

    var body: some View {
        if message.isUser {
            userBubble
        } else {
            coachBubble
        }
    }

    // MARK: - User Bubble

    private var userBubble: some View {
        HStack {
            Spacer(minLength: UIScreen.main.bounds.width * 0.2)

            VStack(alignment: .trailing, spacing: Theme.Spacing.xs) {
                // Image thumbnails
                if !message.imageUrls.isEmpty {
                    imageGrid
                }

                // Text bubble
                if !message.displayText.isEmpty {
                    Text(message.displayText)
                        .font(Theme.Typography.body)
                        .foregroundStyle(Theme.Colors.primaryForeground)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.horizontal, Theme.Spacing.lg)
                        .padding(.vertical, Theme.Spacing.md)
                        .background(Theme.Colors.primary)
                        .clipShape(userBubbleShape)
                }
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("You said: \(message.displayText)")
    }

    // MARK: - Coach Bubble

    private var coachBubble: some View {
        HStack(alignment: .top, spacing: Theme.Spacing.sm) {
            // Coach avatar
            coachAvatar

            VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
                // Main text content
                if !message.displayText.isEmpty || message.isStreaming {
                    coachTextBubble
                }

                // Tool calls: approval cards and status chips
                toolCallsSection
            }
            .frame(
                maxWidth: UIScreen.main.bounds.width * 0.85,
                alignment: .leading
            )

            Spacer(minLength: 0)
        }
        .accessibilityElement(children: .contain)
    }

    // MARK: - Coach Text Bubble

    private var coachTextBubble: some View {
        VStack(alignment: .leading, spacing: 0) {
            if message.isStreaming {
                streamingText
            } else {
                MarkdownText(content: message.displayText)
            }
        }
        .padding(.horizontal, Theme.Spacing.lg)
        .padding(.vertical, Theme.Spacing.md)
        .background(Theme.Colors.card)
        .clipShape(coachBubbleShape)
        .overlay(coachBubbleShape.stroke(Theme.Colors.border, lineWidth: 1))
    }

    // MARK: - Streaming Text

    private var streamingText: some View {
        HStack(alignment: .lastTextBaseline, spacing: 0) {
            MarkdownText(content: message.displayText)
            StreamingCursor()
        }
    }

    // MARK: - Tool Calls Section

    @ViewBuilder
    private var toolCallsSection: some View {
        let toolParts = message.toolCalls
        if !toolParts.isEmpty {
            VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
                ForEach(toolParts) { part in
                    toolPartView(part)
                }
            }
        }
    }

    @ViewBuilder
    private func toolPartView(_ part: MessagePart) -> some View {
        if part.isApprovalRequested {
            ToolApprovalCard(part: part) { approved in
                guard let approvalId = part.approval?.id else { return }
                onApprovalResponse(approvalId, approved)
            }
        } else if part.isApprovalResponded || part.state == "output-denied" {
            approvalResultBadge(part)
        } else if part.isToolRunning || part.isToolDone {
            ToolCallChip(part: part)
        }
    }

    // MARK: - Approval Result Badge

    private func approvalResultBadge(_ part: MessagePart) -> some View {
        let approved = part.approval?.approved ?? false
        return Label(
            approved ? "Approved" : "Denied",
            systemImage: approved ? "checkmark.circle.fill" : "xmark.circle.fill"
        )
        .font(Theme.Typography.caption)
        .foregroundStyle(approved ? Theme.Colors.success : Theme.Colors.destructive)
        .padding(.horizontal, Theme.Spacing.sm)
        .padding(.vertical, Theme.Spacing.xs)
        .background((approved ? Theme.Colors.success : Theme.Colors.destructive).opacity(0.12))
        .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.sm, style: .continuous))
    }

    // MARK: - Image Grid

    private var imageGrid: some View {
        HStack(spacing: Theme.Spacing.xs) {
            ForEach(Array(message.imageUrls.enumerated()), id: \.offset) { _, urlString in
                AsyncImage(url: URL(string: urlString)) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                            .frame(maxWidth: 120, maxHeight: 120)
                            .clipShape(
                                RoundedRectangle(
                                    cornerRadius: Theme.CornerRadius.md, style: .continuous
                                )
                            )
                    case .failure:
                        imagePlaceholder(failed: true)
                    case .empty:
                        imagePlaceholder(failed: false)
                    @unknown default:
                        imagePlaceholder(failed: false)
                    }
                }
                .frame(maxWidth: 120, maxHeight: 120)
            }
        }
    }

    private func imagePlaceholder(failed: Bool) -> some View {
        RoundedRectangle(cornerRadius: Theme.CornerRadius.md, style: .continuous)
            .fill(Theme.Colors.muted)
            .frame(width: 80, height: 80)
            .overlay(
                Image(systemName: failed ? "photo.badge.exclamationmark" : "photo")
                    .font(.system(size: 20))
                    .foregroundStyle(Theme.Colors.textTertiary)
            )
    }

    // MARK: - Coach Avatar

    private var coachAvatar: some View {
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
    }

    // MARK: - Bubble Shapes

    private var userBubbleShape: UnevenRoundedRectangle {
        UnevenRoundedRectangle(
            topLeadingRadius: 16,
            bottomLeadingRadius: 16,
            bottomTrailingRadius: 8,
            topTrailingRadius: 16,
            style: .continuous
        )
    }

    private var coachBubbleShape: UnevenRoundedRectangle {
        UnevenRoundedRectangle(
            topLeadingRadius: 16,
            bottomLeadingRadius: 8,
            bottomTrailingRadius: 16,
            topTrailingRadius: 16,
            style: .continuous
        )
    }
}

// MARK: - Streaming Cursor

/// Blinking cursor appended to streaming coach messages.
private struct StreamingCursor: View {
    @State private var visible = true

    var body: some View {
        Text("|")
            .font(Theme.Typography.body)
            .foregroundStyle(Theme.Colors.primary)
            .opacity(visible ? 1.0 : 0.0)
            .animation(
                .easeInOut(duration: 0.5).repeatForever(autoreverses: true),
                value: visible
            )
            .onAppear { visible = false }
            .accessibilityHidden(true)
    }
}
