import SwiftUI

/// Tappable banner showing an AI coach insight. Navigates to the chat tab on tap.
struct CoachInsightBanner: View {
    let insight: String
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: Theme.Spacing.sm) {
                Image(systemName: "sparkles")
                    .font(.system(size: 14, weight: .semibold))

                Text(insight)
                    .font(Theme.Typography.callout)
                    .multilineTextAlignment(.leading)
            }
            .foregroundStyle(Theme.Colors.primary.opacity(0.8))
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(Theme.Spacing.lg)
            .background(Theme.Colors.primary.opacity(0.1))
            .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.lg))
        }
        .pressableCard()
    }
}
