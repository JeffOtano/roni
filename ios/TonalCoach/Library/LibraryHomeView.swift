import Combine
import ConvexMobile
import SwiftUI

// MARK: - Constants

private let pageSize = 24
private let curatedPageSize = 48

private let curatedSections: [CuratedSectionConfig] = [
    CuratedSectionConfig(
        title: "Quick Workouts",
        subtitle: "30 minutes or less",
        filter: { $0.durationMinutes <= 30 }
    ),
    CuratedSectionConfig(
        title: "Build Muscle",
        subtitle: "Hypertrophy-focused training",
        filter: { $0.goal == "build_muscle" }
    ),
    CuratedSectionConfig(
        title: "Beginner Friendly",
        subtitle: "Great starting points",
        filter: { $0.level == "beginner" }
    ),
    CuratedSectionConfig(
        title: "Full Body Sessions",
        subtitle: "Hit every muscle group",
        filter: { $0.sessionType == "full_body" }
    ),
    CuratedSectionConfig(
        title: "Get Stronger",
        subtitle: "Heavy compounds, low reps",
        filter: { $0.goal == "strength" }
    ),
]

private struct CuratedSectionConfig {
    let title: String
    let subtitle: String
    let filter: (WorkoutCard) -> Bool
}

// MARK: - Library Home View

/// Main browse screen for the workout library.
///
/// When no filters are active, shows curated horizontal sections
/// (matching the web curated browse experience). When filters are
/// active, shows a paginated 2-column grid of matching workouts.
struct LibraryHomeView: View {
    @Environment(ConvexManager.self) private var convex
    @State private var viewModel = LibraryViewModel()
    @State private var showFilterSheet = false
    @State private var searchText = ""

    /// Workouts matching local search text filter.
    private var searchFilteredWorkouts: [WorkoutCard] {
        guard !searchText.isEmpty else { return viewModel.filteredWorkouts }
        let query = searchText.lowercased()
        return viewModel.filteredWorkouts.filter {
            $0.title.lowercased().contains(query)
                || $0.description.lowercased().contains(query)
                || $0.sessionType.lowercased().contains(query)
                || $0.goal.lowercased().contains(query)
        }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.Colors.background
                    .ignoresSafeArea()

                ScrollView {
                    VStack(alignment: .leading, spacing: 0) {
                        headerSection
                        sessionTypeChips
                        contentSection
                    }
                }
                .refreshable {
                    viewModel.refresh(using: convex)
                }
            }
            .searchable(text: $searchText, prompt: "Search workouts")
            .navigationTitle("Workout Library")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    if viewModel.filters.hasActiveFilters {
                        filterToolbarButton
                    }
                }
            }
            .sheet(isPresented: $showFilterSheet) {
                WorkoutFiltersView(filters: $viewModel.filters)
                    .presentationDetents([.medium, .large])
                    .presentationDragIndicator(.visible)
            }
            .navigationDestination(for: WorkoutCard.self) { workout in
                WorkoutDetailView(slug: workout.slug)
            }
            .onAppear {
                viewModel.loadInitial(using: convex)
            }
            .onChange(of: viewModel.filters) { _, _ in
                Task {
                    await viewModel.applyFilters(using: convex)
                }
            }
        }
    }

    // MARK: - Header

    private var headerSection: some View {
        Text(
            viewModel.filters.hasActiveFilters
                ? "Filtered results below. Use the chips and filters to refine."
                : "Expert-designed workouts for every goal, muscle group, and experience level."
        )
        .font(Theme.Typography.body)
        .foregroundStyle(Theme.Colors.textSecondary)
        .padding(.horizontal, Theme.Spacing.lg)
        .padding(.bottom, Theme.Spacing.md)
    }

    // MARK: - Session Type Chips

    private var sessionTypeChips: some View {
        SessionTypeChipsView(filters: $viewModel.filters)
            .padding(.bottom, Theme.Spacing.md)
    }

    // MARK: - Content

    @ViewBuilder
    private var contentSection: some View {
        if viewModel.filters.hasActiveFilters {
            filteredContentView
        } else {
            curatedContentView
        }
    }

    // MARK: - Curated View (No Filters)

    private var curatedContentView: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.xxl) {
            if viewModel.isLoadingInitial {
                curatedSkeletonView
            } else if viewModel.allWorkouts.isEmpty {
                // No data yet - show a message
                VStack(spacing: Theme.Spacing.md) {
                    Spacer().frame(height: 60)
                    ProgressView()
                        .tint(Theme.Colors.primary)
                    Text("Loading workouts...")
                        .font(Theme.Typography.body)
                        .foregroundStyle(Theme.Colors.textSecondary)
                    if let error = viewModel.errorMessage {
                        Text(error)
                            .font(Theme.Typography.caption)
                            .foregroundStyle(Theme.Colors.error)
                    }
                    Spacer().frame(height: 60)
                }
                .frame(maxWidth: .infinity)
            } else {
                // Show curated horizontal sections
                ForEach(curatedSections, id: \.title) { section in
                    let workouts = diversifiedWorkouts(
                        from: viewModel.allWorkouts,
                        matching: section.filter
                    )
                    if workouts.count >= 3 {
                        CuratedSectionRow(
                            title: section.title,
                            subtitle: section.subtitle,
                            workouts: workouts
                        )
                    }
                }

                // Always show a "Browse All" grid below curated sections
                browseAllGrid
            }
        }
        .padding(.bottom, Theme.Spacing.xl)
    }

    // MARK: - Browse All Grid

    private var browseAllGrid: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.md) {
            Text("Browse All")
                .font(Theme.Typography.title2)
                .foregroundStyle(Theme.Colors.textPrimary)
                .padding(.horizontal, Theme.Spacing.lg)

            let columns = [
                GridItem(.flexible(), spacing: Theme.Spacing.md),
                GridItem(.flexible(), spacing: Theme.Spacing.md),
            ]

            LazyVGrid(columns: columns, spacing: Theme.Spacing.md) {
                ForEach(viewModel.allWorkouts) { workout in
                    NavigationLink(value: workout) {
                        WorkoutCardView(workout: workout)
                    }
                    .buttonStyle(CardButtonStyle())
                }
            }
            .padding(.horizontal, Theme.Spacing.lg)
        }
    }

    // MARK: - Filtered View

    private var filteredContentView: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.md) {
            filterControls
            ActiveFilterPillsView(filters: $viewModel.filters)
            resultCountLabel

            if viewModel.isLoadingInitial {
                gridSkeletonView
            } else if viewModel.filteredWorkouts.isEmpty {
                emptyStateView
            } else {
                workoutGrid
            }
        }
        .padding(.horizontal, Theme.Spacing.lg)
        .padding(.bottom, Theme.Spacing.xl)
    }

    // MARK: - Filter Controls

    private var filterControls: some View {
        HStack {
            Button { showFilterSheet = true } label: {
                HStack(spacing: 6) {
                    Image(systemName: "line.3.horizontal.decrease")
                    Text("Filters")
                    if viewModel.filters.activeFilterCount > 0 {
                        Text("\(viewModel.filters.activeFilterCount)")
                            .font(.system(size: 11, weight: .bold))
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Theme.Colors.primary)
                            .foregroundStyle(Theme.Colors.primaryForeground)
                            .clipShape(Capsule())
                    }
                }
                .font(Theme.Typography.calloutMedium)
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(Theme.Colors.card)
                .foregroundStyle(Theme.Colors.textPrimary)
                .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.md))
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.CornerRadius.md)
                        .stroke(Theme.Colors.border, lineWidth: 1)
                )
            }
            .buttonStyle(.plain)

            Spacer()

            if viewModel.filters.hasActiveFilters {
                Button {
                    withAnimation { viewModel.filters.clearAll() }
                } label: {
                    HStack(spacing: 4) {
                        Image(systemName: "xmark")
                            .font(.system(size: 10, weight: .bold))
                        Text("Clear all")
                    }
                    .font(Theme.Typography.caption)
                    .foregroundStyle(Theme.Colors.textSecondary)
                }
                .buttonStyle(.plain)
            }
        }
    }

    // MARK: - Result Count

    private var resultCountLabel: some View {
        let count = viewModel.filteredWorkouts.count
        return HStack(spacing: 6) {
            Text("\(count)")
                .font(Theme.Typography.calloutMedium.monospacedDigit())
                .foregroundStyle(Theme.Colors.textPrimary)
            Text("workout\(count != 1 ? "s" : "") matching filters\(viewModel.canLoadMore ? " so far" : "")")
                .font(Theme.Typography.callout)
                .foregroundStyle(Theme.Colors.textSecondary)
        }
        .padding(.top, Theme.Spacing.xs)
    }

    // MARK: - Workout Grid

    private var workoutGrid: some View {
        let columns = [
            GridItem(.flexible(), spacing: Theme.Spacing.md),
            GridItem(.flexible(), spacing: Theme.Spacing.md),
        ]

        return VStack(spacing: Theme.Spacing.md) {
            LazyVGrid(columns: columns, spacing: Theme.Spacing.md) {
                ForEach(viewModel.filteredWorkouts) { workout in
                    NavigationLink(value: workout) {
                        WorkoutCardView(workout: workout)
                    }
                    .buttonStyle(CardButtonStyle())
                    .onAppear {
                        if workout == viewModel.filteredWorkouts.last {
                            Task { await viewModel.loadMore(using: convex) }
                        }
                    }
                }
            }

            if viewModel.isLoadingMore {
                ProgressView()
                    .tint(Theme.Colors.primary)
                    .padding(Theme.Spacing.lg)
            } else if viewModel.canLoadMore {
                Button {
                    Task { await viewModel.loadMore(using: convex) }
                } label: {
                    Text("Load more workouts")
                        .secondaryButtonStyle()
                }
                .buttonStyle(.plain)
                .padding(.top, Theme.Spacing.md)
            }
        }
    }

    // MARK: - Empty State

    private var emptyStateView: some View {
        VStack(spacing: Theme.Spacing.md) {
            Spacer().frame(height: 60)

            Image(systemName: "magnifyingglass")
                .font(.system(size: 32))
                .padding(Theme.Spacing.lg)
                .background(Theme.Colors.muted)
                .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.xl))
                .foregroundStyle(Theme.Colors.textTertiary)

            Text("No workouts match these filters")
                .font(Theme.Typography.body.weight(.medium))
                .foregroundStyle(Theme.Colors.textPrimary)

            Text("Try broadening your search by removing a filter, or clear them all to see every workout.")
                .font(Theme.Typography.callout)
                .foregroundStyle(Theme.Colors.textSecondary)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 300)

            Button {
                withAnimation { viewModel.filters.clearAll() }
            } label: {
                Text("Clear all filters")
                    .secondaryButtonStyle()
            }
            .buttonStyle(.plain)
            .padding(.top, Theme.Spacing.sm)

            Spacer().frame(height: 60)
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Skeleton Loading

    private var curatedSkeletonView: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.xxl) {
            ForEach(0..<3, id: \.self) { _ in
                VStack(alignment: .leading, spacing: Theme.Spacing.md) {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Theme.Colors.border)
                        .frame(width: 160, height: 20)
                        .cardShimmer()
                        .padding(.horizontal, Theme.Spacing.lg)

                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: Theme.Spacing.md) {
                            ForEach(0..<4, id: \.self) { _ in
                                WorkoutCardSkeleton()
                                    .frame(width: 240, height: 160)
                            }
                        }
                        .padding(.horizontal, Theme.Spacing.lg)
                    }
                }
            }
        }
    }

    private var gridSkeletonView: some View {
        let columns = [
            GridItem(.flexible(), spacing: Theme.Spacing.md),
            GridItem(.flexible(), spacing: Theme.Spacing.md),
        ]

        return LazyVGrid(columns: columns, spacing: Theme.Spacing.md) {
            ForEach(0..<6, id: \.self) { _ in
                WorkoutCardSkeleton()
                    .frame(minHeight: 160)
            }
        }
    }

    // MARK: - Toolbar Buttons

    private var filterToolbarButton: some View {
        Button { showFilterSheet = true } label: {
            Image(systemName: "line.3.horizontal.decrease")
                .foregroundStyle(Theme.Colors.primary)
        }
    }

    // MARK: - Helpers

    /// Diversifies workouts by limiting max 2 per session type (matching web logic).
    private func diversifiedWorkouts(
        from workouts: [WorkoutCard],
        matching filter: (WorkoutCard) -> Bool
    ) -> [WorkoutCard] {
        let matched = shuffledBySlug(workouts.filter(filter))
        var counts: [String: Int] = [:]
        var result: [WorkoutCard] = []

        for workout in matched {
            let count = counts[workout.sessionType, default: 0]
            guard count < 2 else { continue }
            result.append(workout)
            counts[workout.sessionType] = count + 1
            if result.count >= 8 { break }
        }

        return result
    }

    /// Deterministic shuffle by slug hash, matching the web shuffleBySlug function.
    private func shuffledBySlug(_ workouts: [WorkoutCard]) -> [WorkoutCard] {
        workouts.sorted { hashSlug($0.slug) < hashSlug($1.slug) }
    }

    private func hashSlug(_ slug: String) -> Int {
        var hash = 0
        for char in slug.unicodeScalars {
            hash = ((hash &<< 5) &- hash) &+ Int(char.value)
        }
        return hash
    }
}

// MARK: - Curated Section Row

/// A horizontal carousel of workout cards with a header, matching CuratedSection.tsx.
private struct CuratedSectionRow: View {
    let title: String
    let subtitle: String
    let workouts: [WorkoutCard]

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.md) {
            // Section header
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(Theme.Typography.title2)
                    .foregroundStyle(Theme.Colors.textPrimary)
                Text(subtitle)
                    .font(Theme.Typography.callout)
                    .foregroundStyle(Theme.Colors.textSecondary)
            }
            .padding(.horizontal, Theme.Spacing.lg)

            // Horizontal scroll of cards
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: Theme.Spacing.md) {
                    ForEach(workouts) { workout in
                        NavigationLink(value: workout) {
                            WorkoutCardView(workout: workout)
                                .frame(width: 240)
                        }
                        .buttonStyle(CardButtonStyle())
                    }
                }
                .padding(.horizontal, Theme.Spacing.lg)
            }
        }
    }
}

// MARK: - View Model

/// Manages data loading for the library browse screen.
///
/// Uses the Convex subscribe pattern (matching the official quickstart)
/// instead of one-shot queries to ensure data flows after WebSocket connects.
@Observable
final class LibraryViewModel {
    var allWorkouts: [WorkoutCard] = []
    var filteredWorkouts: [WorkoutCard] = []
    var filters = WorkoutFilters()
    var isLoadingInitial = false
    var isLoadingMore = false
    var canLoadMore = false
    var errorMessage: String?

    private var continueCursor: String?
    private var hasLoadedInitial = false
    private var cancellable: AnyCancellable?

    // MARK: - Load via Subscription (matching Convex quickstart pattern)

    /// Subscribes to the Convex query using Combine. No continuation wrapper -
    /// @Observable properties update the UI directly when data arrives.
    func loadInitial(using manager: ConvexManager) {
        guard !hasLoadedInitial else { return }
        isLoadingInitial = true
        errorMessage = nil

        let args = paginationArgs(numItems: curatedPageSize)

        cancellable = manager.client
            .subscribe(
                to: "libraryWorkouts:listFiltered",
                with: args,
                yielding: PaginatedResponse<WorkoutCard>.self
            )
            .receive(on: DispatchQueue.main)
            .sink(
                receiveCompletion: { [weak self] completion in
                    if case .failure(let error) = completion {
                        print("[LoadInit] ERROR: \(error)")
                    } else {
                        print("[LoadInit] completed normally")
                    }
                    guard let self else { return }
                    if !self.hasLoadedInitial {
                        self.isLoadingInitial = false
                        self.errorMessage = "Could not load workouts"
                    }
                },
                receiveValue: { [weak self] response in
                    print("[LoadInit] GOT \(response.page.count) workouts")
                    guard let self else { return }
                    self.allWorkouts = response.page
                    self.continueCursor = response.continueCursor
                    self.canLoadMore = response.hasMore
                    self.hasLoadedInitial = true
                    self.isLoadingInitial = false
                    self.cancellable?.cancel()
                }
            )
    }

    // MARK: - Load More

    func loadMore(using manager: ConvexManager) async {
        guard canLoadMore, !isLoadingMore, let cursor = continueCursor else { return }
        isLoadingMore = true

        let args = paginationArgs(numItems: pageSize, cursor: cursor)

        await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
            var resumed = false
            var moreCancellable: AnyCancellable?
            moreCancellable = manager.client
                .subscribe(to: "libraryWorkouts:listFiltered", with: args, yielding: PaginatedResponse<WorkoutCard>.self)
                .receive(on: DispatchQueue.main)
                .sink(
                    receiveCompletion: { _ in
                        if !resumed { resumed = true; continuation.resume() }
                    },
                    receiveValue: { [weak self] response in
                        moreCancellable?.cancel()
                        if !resumed { resumed = true; continuation.resume() }
                        guard let self else { return }
                        if self.filters.hasActiveFilters {
                            self.filteredWorkouts.append(contentsOf: response.page)
                        } else {
                            self.allWorkouts.append(contentsOf: response.page)
                        }
                        self.continueCursor = response.continueCursor
                        self.canLoadMore = response.hasMore
                        self.isLoadingMore = false
                    }
                )
        }

        isLoadingMore = false
    }

    // MARK: - Apply Filters

    func applyFilters(using manager: ConvexManager) async {
        continueCursor = nil
        canLoadMore = false
        filteredWorkouts = []

        guard filters.hasActiveFilters else {
            // Returning to unfiltered view - curated sections use allWorkouts
            return
        }

        isLoadingInitial = true
        let args = paginationArgs(numItems: pageSize)

        await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
            var resumed = false
            var filterCancellable: AnyCancellable?
            filterCancellable = manager.client
                .subscribe(to: "libraryWorkouts:listFiltered", with: args, yielding: PaginatedResponse<WorkoutCard>.self)
                .receive(on: DispatchQueue.main)
                .sink(
                    receiveCompletion: { _ in
                        if !resumed { resumed = true; continuation.resume() }
                    },
                    receiveValue: { [weak self] response in
                        filterCancellable?.cancel()
                        if !resumed { resumed = true; continuation.resume() }
                        guard let self else { return }
                        self.filteredWorkouts = response.page
                        self.continueCursor = response.continueCursor
                        self.canLoadMore = response.hasMore
                        self.isLoadingInitial = false
                    }
                )
        }

        isLoadingInitial = false
    }

    // MARK: - Refresh

    func refresh(using manager: ConvexManager) {
        hasLoadedInitial = false
        allWorkouts = []
        filteredWorkouts = []
        continueCursor = nil
        canLoadMore = false
        loadInitial(using: manager)
    }

    // MARK: - Query Args Builder

    private func paginationArgs(
        numItems: Int,
        cursor: String? = nil
    ) -> [String: ConvexEncodable?] {
        var filterArgs = filters.toQueryArgs()

        // IMPORTANT: numItems must be Double, not Int.
        // Convex paginationOptsValidator uses v.float64() for numItems.
        // Swift Int encodes as $integer (base64) which Convex rejects.
        // Double encodes as a plain JSON number which matches float64.
        let paginationOpts: [String: ConvexEncodable?] = [
            "numItems": Double(numItems),
            "cursor": cursor,
        ]
        filterArgs["paginationOpts"] = paginationOpts

        return filterArgs
    }
}
