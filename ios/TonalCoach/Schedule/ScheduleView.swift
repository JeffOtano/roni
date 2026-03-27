import SwiftUI

// MARK: - Shared Date Formatter

/// File-private ISO date formatter shared by ScheduleView and the todayGlowIfToday extension.
private let scheduleISODateFormatter: DateFormatter = {
    let formatter = DateFormatter()
    formatter.dateFormat = "yyyy-MM-dd"
    formatter.locale = Locale(identifier: "en_US_POSIX")
    return formatter
}()

// MARK: - Schedule View

/// Weekly schedule screen showing the user's 7-day training plan.
///
/// Loads data via a single `schedule:getScheduleData` action call.
/// Training days are tappable cards; rest days are minimal rows.
struct ScheduleView: View {
    @Environment(ConvexManager.self) private var convex
    @State private var viewModel = ScheduleViewModel()

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.Colors.background
                    .ignoresSafeArea()

                Group {
                    if viewModel.isLoading {
                        loadingView
                    } else if let error = viewModel.errorMessage {
                        errorView(error)
                    } else if viewModel.hasTrainingDays {
                        dayListView
                    } else {
                        emptyStateView
                    }
                }
            }
            .navigationTitle("Schedule")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    if let subtitle = viewModel.weekSubtitle {
                        Text(subtitle)
                            .font(Theme.Typography.caption)
                            .foregroundStyle(Theme.Colors.textSecondary)
                    }
                }
            }
            .refreshable {
                await viewModel.load(using: convex)
            }
            .navigationDestination(for: ScheduleDay.self) { day in
                DayDetailView(day: day)
            }
            .task {
                await viewModel.loadIfNeeded(using: convex)
            }
        }
    }

    // MARK: - Date Helpers

    /// Returns true if the ISO date string represents today.
    private func isToday(_ isoDate: String) -> Bool {
        guard let date = parsedDate(isoDate) else { return false }
        return Calendar.current.isDateInToday(date)
    }

    /// Returns true if the ISO date string represents a day strictly before today.
    private func isPastDay(_ isoDate: String) -> Bool {
        guard let date = parsedDate(isoDate) else { return false }
        return date < Calendar.current.startOfDay(for: Date())
    }

    private func parsedDate(_ isoDate: String) -> Date? {
        scheduleISODateFormatter.date(from: isoDate)
    }

    // MARK: - Day List

    private var dayListView: some View {
        ScrollView {
            VStack(spacing: Theme.Spacing.md) {
                if let subtitle = viewModel.weekSubtitle {
                    Text(subtitle)
                        .font(Theme.Typography.callout)
                        .foregroundStyle(Theme.Colors.textSecondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, Theme.Spacing.lg)
                }

                ForEach(Array(viewModel.days.enumerated()), id: \.element.id) { index, day in
                    if day.isTraining {
                        NavigationLink(value: day) {
                            ScheduleDayCard(day: day)
                        }
                        .pressableCard()
                        .todayGlowIfToday(day.date)
                        .opacity(isPastDay(day.date) ? 0.6 : 1.0)
                        .staggeredAppear(index: index)
                    } else {
                        ScheduleDayCard(day: day)
                            .todayGlowIfToday(day.date)
                            .opacity(isPastDay(day.date) ? 0.6 : 1.0)
                            .staggeredAppear(index: index)
                    }
                }
                .padding(.horizontal, Theme.Spacing.lg)
            }
            .padding(.vertical, Theme.Spacing.md)
        }
    }

    // MARK: - Loading

    private var loadingView: some View {
        ScrollView {
            VStack(spacing: Theme.Spacing.md) {
                ForEach(0..<3, id: \.self) { _ in
                    ScheduleDayCardSkeleton()
                }
            }
            .padding(.horizontal, Theme.Spacing.lg)
            .padding(.vertical, Theme.Spacing.md)
        }
    }

    // MARK: - Error

    private func errorView(_ message: String) -> some View {
        VStack(spacing: Theme.Spacing.md) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 32))
                .foregroundStyle(Theme.Colors.textTertiary)
                .accessibilityHidden(true)

            Text("Unable to load schedule")
                .font(Theme.Typography.headline)
                .foregroundStyle(Theme.Colors.textPrimary)

            Text(message)
                .font(Theme.Typography.callout)
                .foregroundStyle(Theme.Colors.textSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 280)

            Button {
                Task { await viewModel.load(using: convex) }
            } label: {
                Text("Try Again")
                    .primaryButtonStyle()
            }
            .buttonStyle(.plain)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Empty State

    private var emptyStateView: some View {
        VStack(spacing: Theme.Spacing.md) {
            Image(systemName: "calendar")
                .font(.system(size: 32))
                .foregroundStyle(Theme.Colors.textTertiary)
                .accessibilityHidden(true)

            Text("No schedule this week")
                .font(Theme.Typography.headline)
                .foregroundStyle(Theme.Colors.textPrimary)

            Text("Your weekly training plan will appear here once your coach generates one.")
                .font(Theme.Typography.callout)
                .foregroundStyle(Theme.Colors.textSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 280)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Skeleton Card

/// Placeholder card shown during initial load, matching the shape of ScheduleDayCard.
private struct ScheduleDayCardSkeleton: View {
    var body: some View {
        HStack(spacing: Theme.Spacing.md) {
            RoundedRectangle(cornerRadius: 2)
                .fill(Theme.Colors.border)
                .frame(width: 3, height: 60)

            VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
                RoundedRectangle(cornerRadius: 3)
                    .fill(Theme.Colors.border)
                    .frame(width: 80, height: 14)
                RoundedRectangle(cornerRadius: 3)
                    .fill(Theme.Colors.border)
                    .frame(width: 140, height: 12)
                RoundedRectangle(cornerRadius: 3)
                    .fill(Theme.Colors.border)
                    .frame(width: 200, height: 12)
            }
            Spacer()
        }
        .padding(Theme.Spacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .cardStyle()
        .shimmer()
    }
}

// MARK: - View Model

/// Manages data loading for the schedule screen.
///
/// Uses async/await with `ConvexManager.action()` (matching TonalDashboardView pattern).
/// The action returns all data in one shot, no pagination needed.
@Observable
final class ScheduleViewModel {
    var days: [ScheduleDay] = []
    var weekStartDate: String?
    var isLoading = false
    var errorMessage: String?

    private var hasLoaded = false

    /// Whether any training days exist in the loaded schedule.
    var hasTrainingDays: Bool {
        days.contains { $0.isTraining }
    }

    /// Formatted week subtitle: "Mar 24 - Mar 30".
    var weekSubtitle: String? {
        guard let startStr = weekStartDate else { return nil }
        return formatWeekRange(from: startStr)
    }

    // MARK: - Load

    @MainActor
    func loadIfNeeded(using manager: ConvexManager) async {
        guard !hasLoaded, !isLoading else { return }
        await load(using: manager)
    }

    @MainActor
    func load(using manager: ConvexManager) async {
        isLoading = true
        errorMessage = nil

        do {
            let data: ScheduleData? = try await manager.action(
                "schedule:getScheduleData", with: [:]
            )
            days = data?.days ?? []
            weekStartDate = data?.weekStartDate ?? ""
            hasLoaded = true
            errorMessage = nil
        } catch {
            errorMessage = "Could not load schedule. Check your connection and try again."
        }

        isLoading = false
    }

    // MARK: - Date Formatting

    private static let isoParseFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        formatter.locale = Locale(identifier: "en_US_POSIX")
        return formatter
    }()

    private static let isoDisplayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d"
        return formatter
    }()

    /// Converts "2026-03-24" to "Mar 24 - Mar 30" (7-day range).
    private func formatWeekRange(from isoDate: String) -> String? {
        guard let start = Self.isoParseFormatter.date(from: isoDate) else { return nil }
        guard let end = Calendar.current.date(byAdding: .day, value: 6, to: start) else {
            return nil
        }
        return "\(Self.isoDisplayFormatter.string(from: start)) - \(Self.isoDisplayFormatter.string(from: end))"
    }
}

// MARK: - Conditional Today Glow

private extension View {
    /// Applies `.todayGlow()` only when the ISO date string matches today.
    func todayGlowIfToday(_ isoDate: String) -> some View {
        let isToday = scheduleISODateFormatter.date(from: isoDate).map {
            Calendar.current.isDateInToday($0)
        } ?? false
        return Group {
            if isToday {
                self.todayGlow()
            } else {
                self
            }
        }
    }
}
