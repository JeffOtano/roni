import SwiftUI

// MARK: - Filter Options

/// All available filter option sets, matching the web WorkoutFilters.tsx.
enum FilterOptions {
    /// Compound session types shown as primary chips in the browse header.
    static let compoundSessionTypes: [(value: String, label: String)] = [
        ("push", "Push"),
        ("pull", "Pull"),
        ("legs", "Legs"),
        ("upper", "Upper Body"),
        ("lower", "Lower Body"),
        ("full_body", "Full Body"),
    ]

    /// Isolation session types shown after the divider.
    static let isolationSessionTypes: [(value: String, label: String)] = [
        ("chest", "Chest"),
        ("back", "Back"),
        ("shoulders", "Shoulders"),
        ("arms", "Arms"),
        ("core", "Core"),
        ("glutes_hamstrings", "Glutes & Hams"),
        ("chest_back", "Chest & Back"),
    ]

    static let goals: [(value: String, label: String)] = [
        ("build_muscle", "Hypertrophy"),
        ("fat_loss", "Fat Loss"),
        ("strength", "Strength"),
        ("endurance", "Endurance"),
        ("athletic", "Athletic"),
        ("general_fitness", "General Fitness"),
        ("power", "Power"),
        ("functional", "Functional"),
        ("mobility_flexibility", "Mobility"),
        ("sport_complement", "Sport Complement"),
    ]

    static let durations: [(value: Int, label: String)] = [
        (20, "20 min"),
        (30, "30 min"),
        (45, "45 min"),
        (60, "60 min"),
    ]

    static let levels: [(value: String, label: String)] = [
        ("beginner", "Beginner"),
        ("intermediate", "Intermediate"),
        ("advanced", "Advanced"),
    ]
}

// MARK: - Session Type Chips

/// Horizontal row of session type filter chips, matching SessionTypeChips.tsx.
/// Shows compound types, a divider, then isolation types.
struct SessionTypeChipsView: View {
    @Binding var filters: WorkoutFilters

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Theme.Spacing.sm) {
                ForEach(FilterOptions.compoundSessionTypes, id: \.value) { option in
                    FilterChip(
                        label: option.label,
                        isSelected: filters.sessionTypes.contains(option.value)
                    ) {
                        toggleSessionType(option.value)
                    }
                }

                // Divider between compound and isolation types
                Rectangle()
                    .fill(Theme.Colors.border)
                    .frame(width: 1, height: 20)

                ForEach(FilterOptions.isolationSessionTypes, id: \.value) { option in
                    FilterChip(
                        label: option.label,
                        isSelected: filters.sessionTypes.contains(option.value)
                    ) {
                        toggleSessionType(option.value)
                    }
                }
            }
            .padding(.horizontal, Theme.Spacing.md)
        }
    }

    private func toggleSessionType(_ value: String) {
        Theme.Haptics.selection()
        withAnimation(.easeInOut(duration: 0.2)) {
            if filters.sessionTypes.contains(value) {
                filters.sessionTypes.remove(value)
            } else {
                filters.sessionTypes = [value]
            }
        }
    }
}

// MARK: - Filter Chip

/// A single toggleable filter chip matching the web Chip design.
struct FilterChip: View {
    let label: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(Theme.Typography.calloutMedium)
                .padding(.horizontal, 14)
                .padding(.vertical, 7)
                .background(isSelected ? Theme.Colors.primary : Color.clear)
                .foregroundStyle(
                    isSelected ? Theme.Colors.primaryForeground : Theme.Colors.mutedForeground
                )
                .clipShape(Capsule())
                .overlay(
                    Capsule()
                        .stroke(
                            isSelected ? Theme.Colors.primary : Theme.Colors.border,
                            lineWidth: 1
                        )
                )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Filter Sheet

/// Full filter sheet presented modally, with sections for goal, duration, and level.
/// Matches the web WorkoutFilters.tsx functionality.
struct WorkoutFiltersView: View {
    @Binding var filters: WorkoutFilters
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Theme.Spacing.xl) {
                    goalSection
                    durationSection
                    levelSection
                }
                .padding(Theme.Spacing.lg)
            }
            .background(Theme.Colors.background)
            .navigationTitle("Filters")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    if filters.hasActiveFilters {
                        Button("Clear All") {
                            withAnimation { filters.clearAll() }
                        }
                        .foregroundStyle(Theme.Colors.primary)
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                        .fontWeight(.semibold)
                        .foregroundStyle(Theme.Colors.primary)
                }
            }
        }
    }

    // MARK: - Goal Section

    private var goalSection: some View {
        FilterSection(title: "Goal") {
            FilterChipGrid(
                options: FilterOptions.goals,
                selected: filters.goals,
                onToggle: { value in
                    withAnimation(.easeInOut(duration: 0.2)) {
                        if filters.goals.contains(value) {
                            filters.goals.remove(value)
                        } else {
                            filters.goals = [value]
                        }
                    }
                }
            )
        }
    }

    // MARK: - Duration Section

    private var durationSection: some View {
        FilterSection(title: "Duration") {
            HStack(spacing: Theme.Spacing.sm) {
                ForEach(FilterOptions.durations, id: \.value) { option in
                    FilterChip(
                        label: option.label,
                        isSelected: filters.durationMinutes == option.value
                    ) {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            if filters.durationMinutes == option.value {
                                filters.durationMinutes = nil
                            } else {
                                filters.durationMinutes = option.value
                            }
                        }
                    }
                }
            }
        }
    }

    // MARK: - Level Section

    private var levelSection: some View {
        FilterSection(title: "Level") {
            FilterChipGrid(
                options: FilterOptions.levels,
                selected: filters.levels,
                onToggle: { value in
                    withAnimation(.easeInOut(duration: 0.2)) {
                        if filters.levels.contains(value) {
                            filters.levels.remove(value)
                        } else {
                            filters.levels = [value]
                        }
                    }
                }
            )
        }
    }
}

// MARK: - Filter Section

private struct FilterSection<Content: View>: View {
    let title: String
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.md) {
            Text(title)
                .font(Theme.Typography.headline)
                .foregroundStyle(Theme.Colors.textPrimary)
            content
        }
    }
}

// MARK: - Filter Chip Grid

/// Wrapping grid of filter chips for a set of options.
private struct FilterChipGrid: View {
    let options: [(value: String, label: String)]
    let selected: Set<String>
    let onToggle: (String) -> Void

    var body: some View {
        LibraryFlowLayout(spacing: Theme.Spacing.sm) {
            ForEach(options, id: \.value) { option in
                FilterChip(
                    label: option.label,
                    isSelected: selected.contains(option.value),
                    action: { onToggle(option.value) }
                )
            }
        }
    }
}

// MARK: - Active Filter Pills

/// Row of active filter pills with dismiss buttons, matching ActiveFilterPills.tsx.
struct ActiveFilterPillsView: View {
    @Binding var filters: WorkoutFilters

    var body: some View {
        let pairs = filters.activeFilterPairs
        if !pairs.isEmpty {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: Theme.Spacing.sm) {
                    ForEach(pairs, id: \.key) { pair in
                        ActiveFilterPill(
                            label: pair.label,
                            onRemove: {
                                withAnimation(.easeInOut(duration: 0.2)) {
                                    filters.removeFilter(for: pair.key)
                                }
                            }
                        )
                    }
                }
                .padding(.horizontal, Theme.Spacing.md)
            }
        }
    }
}

// MARK: - Active Pill

private struct ActiveFilterPill: View {
    let label: String
    let onRemove: () -> Void

    var body: some View {
        HStack(spacing: 4) {
            Text(label)
                .font(.system(size: 13, weight: .medium))

            Button(action: onRemove) {
                Image(systemName: "xmark")
                    .font(.system(size: 10, weight: .bold))
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .foregroundStyle(Theme.Colors.primary)
        .background(Theme.Colors.primary.opacity(0.15))
        .clipShape(Capsule())
        .overlay(
            Capsule()
                .stroke(Theme.Colors.primary.opacity(0.3), lineWidth: 1)
        )
    }
}

// MARK: - Flow Layout

/// Wrapping layout that flows children to the next line when horizontal space runs out.
struct LibraryFlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let result = computeLayout(proposal: proposal, subviews: subviews)
        return result.size
    }

    func placeSubviews(
        in bounds: CGRect,
        proposal: ProposedViewSize,
        subviews: Subviews,
        cache: inout ()
    ) {
        let result = computeLayout(proposal: proposal, subviews: subviews)
        for (index, position) in result.positions.enumerated() {
            subviews[index].place(
                at: CGPoint(x: bounds.minX + position.x, y: bounds.minY + position.y),
                proposal: .unspecified
            )
        }
    }

    private struct LayoutResult {
        let size: CGSize
        let positions: [CGPoint]
    }

    private func computeLayout(proposal: ProposedViewSize, subviews: Subviews) -> LayoutResult {
        let maxWidth = proposal.width ?? .infinity
        var positions: [CGPoint] = []
        var currentX: CGFloat = 0
        var currentY: CGFloat = 0
        var lineHeight: CGFloat = 0
        var totalWidth: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)

            if currentX + size.width > maxWidth, currentX > 0 {
                currentX = 0
                currentY += lineHeight + spacing
                lineHeight = 0
            }

            positions.append(CGPoint(x: currentX, y: currentY))
            lineHeight = max(lineHeight, size.height)
            currentX += size.width + spacing
            totalWidth = max(totalWidth, currentX - spacing)
        }

        return LayoutResult(
            size: CGSize(width: totalWidth, height: currentY + lineHeight),
            positions: positions
        )
    }
}
