import SwiftUI

// MARK: - Tool Call Chip

/// Compact status indicator for tool execution within coach messages.
///
/// Shows three states:
/// - **Running**: spinner + label + "..."
/// - **Done**: green checkmark + label
/// - **Denied**: red X + label
struct ToolCallChip: View {
    let part: MessagePart

    var body: some View {
        HStack(spacing: Theme.Spacing.xs) {
            statusIcon
            Text(statusLabel)
                .font(Theme.Typography.caption)
                .foregroundStyle(Theme.Colors.textSecondary)
        }
        .padding(.horizontal, Theme.Spacing.sm)
        .padding(.vertical, Theme.Spacing.xs)
        .background(Theme.Colors.muted)
        .clipShape(Capsule())
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityDescription)
    }

    // MARK: - Status Icon

    @ViewBuilder
    private var statusIcon: some View {
        if part.isToolRunning {
            ProgressView()
                .controlSize(.mini)
                .tint(Theme.Colors.textSecondary)
        } else if part.isToolDone {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 12))
                .foregroundStyle(Theme.Colors.success)
        } else if isDenied {
            Image(systemName: "xmark.circle.fill")
                .font(.system(size: 12))
                .foregroundStyle(Theme.Colors.destructive)
        }
    }

    // MARK: - Labels

    private var statusLabel: String {
        if part.isToolRunning {
            return "\(part.toolLabel)..."
        }
        return part.toolLabel
    }

    private var isDenied: Bool {
        part.state == "output-denied" || (part.isApprovalResponded && part.approval?.approved == false)
    }

    private var accessibilityDescription: String {
        if part.isToolRunning {
            return "\(part.toolLabel), in progress"
        } else if part.isToolDone {
            return "\(part.toolLabel), completed"
        } else if isDenied {
            return "\(part.toolLabel), denied"
        }
        return part.toolLabel
    }
}
