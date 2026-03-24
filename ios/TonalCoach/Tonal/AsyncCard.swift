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

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.md) {
            Text(title)
                .font(Theme.Typography.title2)
                .foregroundStyle(Theme.Colors.textPrimary)

            if isLoading {
                loadingView
            } else if let error {
                errorView(error)
            } else if let data {
                content(data)
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

    func reload() async {
        await loadData()
    }

    private var loadingView: some View {
        VStack(spacing: Theme.Spacing.md) {
            ForEach(0..<3, id: \.self) { _ in
                RoundedRectangle(cornerRadius: 4)
                    .fill(Theme.Colors.border)
                    .frame(height: 16)
            }
        }
        .frame(minHeight: 80)
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
