import SwiftUI

// MARK: - Markdown Text

/// Renders markdown-formatted text from coach messages.
///
/// Uses `AttributedString(markdown:)` for bold, italic, headings, lists, code, and links.
/// Code blocks render in a monospace font with a muted background.
/// Falls back to plain Text if markdown parsing fails.
struct MarkdownText: View {
    let content: String

    var body: some View {
        if content.isEmpty {
            EmptyView()
        } else if let extracted = extractWeekPlan(from: content) {
            // Week plan detected: render as structured card + remaining text
            VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
                if !extracted.remainingText.isEmpty {
                    inlineMarkdown(extracted.remainingText)
                }
                WeekPlanCard(plan: extracted.plan)
            }
        } else if let blocks = parseBlocks(from: content), hasCodeBlocks(blocks) {
            // Mixed content with code blocks: render block-by-block
            VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
                ForEach(Array(blocks.enumerated()), id: \.offset) { _, block in
                    switch block {
                    case .text(let text):
                        inlineMarkdown(text)
                    case .code(let code, _):
                        codeBlock(code)
                    }
                }
            }
        } else {
            // No code blocks: render as a single attributed string
            inlineMarkdown(content)
        }
    }

    // MARK: - Inline Markdown

    @ViewBuilder
    private func inlineMarkdown(_ text: String) -> some View {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty {
            EmptyView()
        } else if let attributed = parseAttributedString(trimmed) {
            Text(attributed)
                .font(Theme.Typography.body)
                .foregroundStyle(Theme.Colors.textPrimary)
                .tint(Theme.Colors.primary)
                .fixedSize(horizontal: false, vertical: true)
        } else {
            Text(trimmed)
                .font(Theme.Typography.body)
                .foregroundStyle(Theme.Colors.textPrimary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    // MARK: - Code Block

    private func codeBlock(_ code: String) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            Text(code)
                .font(Theme.Typography.monoText)
                .foregroundStyle(Theme.Colors.textPrimary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(Theme.Spacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Colors.muted)
        .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.md, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.CornerRadius.md, style: .continuous)
                .stroke(Theme.Colors.border, lineWidth: 1)
        )
    }

    // MARK: - Parsing

    private func parseAttributedString(_ text: String) -> AttributedString? {
        var options = AttributedString.MarkdownParsingOptions()
        options.interpretedSyntax = .inlineOnlyPreservingWhitespace
        return try? AttributedString(markdown: text, options: options)
    }

    /// Splits content into text and code blocks for block-level rendering.
    private func parseBlocks(from text: String) -> [ContentBlock]? {
        let pattern = "```(?:\\w*)\n([\\s\\S]*?)```"
        guard let regex = try? NSRegularExpression(pattern: pattern) else { return nil }

        let nsString = text as NSString
        let matches = regex.matches(in: text, range: NSRange(location: 0, length: nsString.length))
        guard !matches.isEmpty else { return nil }

        var blocks: [ContentBlock] = []
        var cursor = 0

        for match in matches {
            let matchRange = match.range
            // Text before the code block
            if matchRange.location > cursor {
                let textRange = NSRange(location: cursor, length: matchRange.location - cursor)
                let textContent = nsString.substring(with: textRange)
                if !textContent.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    blocks.append(.text(textContent))
                }
            }
            // The code block content (capture group 1)
            let codeRange = match.range(at: 1)
            let codeContent = nsString.substring(with: codeRange)
            blocks.append(.code(codeContent, language: nil))
            cursor = matchRange.location + matchRange.length
        }

        // Remaining text after last code block
        if cursor < nsString.length {
            let remaining = nsString.substring(from: cursor)
            if !remaining.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                blocks.append(.text(remaining))
            }
        }

        return blocks
    }

    private func hasCodeBlocks(_ blocks: [ContentBlock]) -> Bool {
        blocks.contains { if case .code = $0 { return true } else { return false } }
    }
}

// MARK: - Content Block

private enum ContentBlock {
    case text(String)
    case code(String, language: String?)
}
