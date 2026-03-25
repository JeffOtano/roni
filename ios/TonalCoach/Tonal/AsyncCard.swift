import SwiftUI

/// Reusable card wrapper that manages async loading, error, and content states.
/// Used by each dashboard section to load data independently.
struct AsyncCard<T, Content: View>: View {
    let title: String
    let load: () async throws -> T
    @ViewBuilder let content: (T) -> Content

    @State private var data: T?
    @State private var isLoading = true
    @State private var error: String?
    @State private var isRevealed = false

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.md) {
            Text(title)
                .font(Theme.Typography.title2)
                .foregroundStyle(Theme.Colors.textPrimary)

            if isLoading {
                loadingView
                    .transition(.opacity)
            } else if let error {
                errorView(error)
            } else if let data {
                content(data)
                    .opacity(isRevealed ? 1 : 0)
                    .offset(y: isRevealed ? 0 : 8)
                    .onAppear {
                        withAnimation(Animate.smooth) {
                            isRevealed = true
                        }
                    }
                    .transition(.opacity)
            }

        }
        .padding(Theme.Spacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Colors.card)
        .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.CornerRadius.lg, style: .continuous)
                .stroke(Theme.Colors.border, lineWidth: 1)
        )
        .animation(.easeOut(duration: 0.2), value: isLoading)
        .task { await loadData() }
    }

    private func loadData() async {
        isLoading = true
        error = nil
        do {
            data = try await load()
        } catch {
            self.error = "Failed to load"
        }
        isLoading = false
    }

    private var loadingView: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            ShimmerView(height: 16, width: 120)
            ShimmerView(height: 12)
            ShimmerView(height: 12, width: 200)
        }
        .frame(minHeight: 80, alignment: .topLeading)
    }

    private func errorView(_ message: String) -> some View {
        VStack(spacing: Theme.Spacing.sm) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 24))
                .foregroundStyle(Theme.Colors.textTertiary)
            Text(message)
                .font(Theme.Typography.callout)
                .foregroundStyle(Theme.Colors.textSecondary)
            Button("Retry") {
                Task { await loadData() }
            }
            .font(Theme.Typography.calloutMedium)
            .foregroundStyle(Theme.Colors.primary)
        }
        .frame(maxWidth: .infinity, minHeight: 80)
    }
}
