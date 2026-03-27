import SwiftUI

// MARK: - Tool Approval Card

/// Interactive card for tool approval requests.
///
/// Displays what the coach wants to do and lets the user approve or deny.
/// Shows a loading state while processing and a result badge when complete.
/// Collapses to a single-line summary after resolution.
struct ToolApprovalCard: View {
    let part: MessagePart
    let onRespond: (Bool) -> Void

    @State private var status: ApprovalStatus = .pending
    @State private var hasAppeared = false

    var body: some View {
        resolvedContent
            .opacity(hasAppeared ? 1 : 0)
            .offset(y: hasAppeared ? 0 : 12)
            .onAppear {
                guard !hasAppeared else { return }
                withAnimation(Animate.smooth) { hasAppeared = true }
            }
            .onChange(of: resolvedApproval) { _, resolved in
                if let approved = resolved {
                    status = approved ? .approved : .denied
                }
            }
    }

    // MARK: - Resolved Content

    @ViewBuilder
    private var resolvedContent: some View {
        if status == .approved || status == .denied {
            collapsedSummary
                .animation(Animate.smooth, value: status)
        } else {
            fullCard
                .animation(Animate.smooth, value: status)
        }
    }

    // MARK: - Collapsed Summary

    private var collapsedSummary: some View {
        HStack(spacing: Theme.Spacing.sm) {
            Image(
                systemName: status == .approved
                    ? "checkmark.circle.fill"
                    : "xmark.circle.fill"
            )
            .foregroundStyle(
                status == .approved
                    ? Theme.Colors.success
                    : Theme.Colors.mutedForeground
            )
            Text(
                status == .approved
                    ? "Approved: \(toolDisplayName)"
                    : "Declined"
            )
            .font(Theme.Typography.caption)
            .foregroundStyle(Theme.Colors.mutedForeground)
        }
        .padding(Theme.Spacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(
            status == .approved
                ? "Approved: \(toolDisplayName)"
                : "Declined"
        )
    }

    // MARK: - Full Card

    private var fullCard: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.md) {
            // Tool label
            Text(part.toolLabel)
                .font(Theme.Typography.headline)
                .foregroundStyle(Theme.Colors.textPrimary)

            // Description of what the tool does
            Text(toolDescription)
                .font(Theme.Typography.callout)
                .foregroundStyle(Theme.Colors.textSecondary)

            // Action area
            actionArea
        }
        .padding(Theme.Spacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Colors.card)
        .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.CornerRadius.lg, style: .continuous)
                .stroke(Theme.Colors.primary.opacity(0.3), lineWidth: 1)
        )
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Tool approval: \(part.toolLabel)")
    }

    // MARK: - Action Area

    @ViewBuilder
    private var actionArea: some View {
        switch status {
        case .pending:
            HStack(spacing: Theme.Spacing.md) {
                // Approve button
                Button {
                    Theme.Haptics.medium()
                    status = .processing
                    onRespond(true)
                } label: {
                    Label("Approve", systemImage: "checkmark")
                        .font(Theme.Typography.calloutMedium)
                        .foregroundStyle(Theme.Colors.primaryForeground)
                        .padding(.horizontal, Theme.Spacing.lg)
                        .padding(.vertical, Theme.Spacing.sm)
                        .background(Theme.Colors.success)
                        .clipShape(
                            RoundedRectangle(cornerRadius: Theme.CornerRadius.md, style: .continuous)
                        )
                }
                .shadow(color: Theme.Colors.success.opacity(0.2), radius: 4, y: 2)
                .accessibilityHint("Allows the coach to proceed with this action")

                // Deny button
                Button {
                    Theme.Haptics.medium()
                    status = .processing
                    onRespond(false)
                } label: {
                    Label("Deny", systemImage: "xmark")
                        .font(Theme.Typography.calloutMedium)
                        .foregroundStyle(Theme.Colors.foreground)
                        .padding(.horizontal, Theme.Spacing.lg)
                        .padding(.vertical, Theme.Spacing.sm)
                        .background(Theme.Colors.muted)
                        .clipShape(
                            RoundedRectangle(cornerRadius: Theme.CornerRadius.md, style: .continuous)
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: Theme.CornerRadius.md, style: .continuous)
                                .stroke(Theme.Colors.border, lineWidth: 1)
                        )
                }
                .accessibilityHint("Prevents the coach from performing this action")
            }

        case .processing:
            HStack(spacing: Theme.Spacing.sm) {
                ProgressView()
                    .controlSize(.small)
                    .tint(Theme.Colors.textSecondary)
                Text("Processing...")
                    .font(Theme.Typography.callout)
                    .foregroundStyle(Theme.Colors.textSecondary)
            }
            .accessibilityLabel("Processing approval")

        case .approved:
            resultBadge(approved: true)

        case .denied:
            resultBadge(approved: false)
        }
    }

    // MARK: - Result Badge

    private func resultBadge(approved: Bool) -> some View {
        Label(
            approved ? "Approved" : "Denied",
            systemImage: approved ? "checkmark.circle.fill" : "xmark.circle.fill"
        )
        .font(Theme.Typography.calloutMedium)
        .foregroundStyle(approved ? Theme.Colors.success : Theme.Colors.destructive)
        .padding(.horizontal, Theme.Spacing.md)
        .padding(.vertical, Theme.Spacing.xs)
        .background((approved ? Theme.Colors.success : Theme.Colors.destructive).opacity(0.12))
        .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.sm, style: .continuous))
    }

    // MARK: - Tool Display Name

    private var toolDisplayName: String {
        part.toolLabel
    }

    // MARK: - Tool Description

    private var toolDescription: String {
        switch part.toolName {
        case "approve_week_plan":
            return "The coach wants to push workouts to your Tonal."
        case "create_workout":
            return "The coach wants to create a workout on your Tonal."
        case "delete_workout":
            return "The coach wants to delete a workout from your Tonal."
        case "delete_week_plan":
            return "The coach wants to delete the current week plan."
        default:
            return "The coach wants to perform an action that requires your approval."
        }
    }

    // MARK: - Resolved Approval

    /// Reads the approval state from the message part to sync with server updates.
    private var resolvedApproval: Bool? {
        guard part.isApprovalResponded || part.state == "output-denied" else { return nil }
        return part.approval?.approved
    }
}

// MARK: - Approval Status

private enum ApprovalStatus {
    case pending
    case processing
    case approved
    case denied
}
