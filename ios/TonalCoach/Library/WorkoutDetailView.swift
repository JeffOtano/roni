import SwiftUI

/// Full detail view for a library workout, loaded by slug.
///
/// Matches the web detail page layout: hero header with badges, "Open in Tonal"
/// CTA, quick stats bar, grouped exercise list, rationale, FAQ, and related workouts.
struct WorkoutDetailView: View {
    let slug: String
    @Environment(ConvexManager.self) private var convex
    @State private var workout: LibraryWorkout?
    @State private var relatedWorkouts: [WorkoutCard] = []
    @State private var isLoading = true
    @State private var error: String?

    var body: some View {
        ZStack(alignment: .bottom) {
            ScrollView {
                if isLoading {
                    WorkoutDetailSkeleton()
                } else if let workout {
                    WorkoutDetailContent(
                        workout: workout,
                        relatedWorkouts: relatedWorkouts
                    )
                    // Bottom padding so content doesn't hide behind floating CTA
                    Spacer().frame(height: 80)
                } else if let error {
                    WorkoutDetailError(message: error, onRetry: { Task { await loadWorkout() } })
                }
            }

            // Floating sticky "Open in Tonal" CTA
            if let workout, let url = workout.tonalDeepLinkUrl, !isLoading {
                FloatingTonalCTA(url: url)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .background(Theme.Colors.background)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                Text(workout?.title ?? "")
                    .font(Theme.Typography.caption)
                    .foregroundStyle(Theme.Colors.textPrimary)
                    .lineLimit(1)
            }
            ToolbarItem(placement: .topBarTrailing) {
                if let workout {
                    ShareLink(
                        item: URL(string: "https://tonal.coach/workouts/\(workout.slug)")!,
                        subject: Text(workout.title),
                        message: Text(workout.description)
                    ) {
                        Image(systemName: "square.and.arrow.up")
                            .foregroundStyle(Theme.Colors.textSecondary)
                    }
                }
            }
        }
        .task {
            await loadWorkout()
        }
    }

    private func loadWorkout() async {
        isLoading = true
        error = nil
        do {
            let result: LibraryWorkout? = try await convex.query(
                "libraryWorkouts:getBySlug",
                args: ["slug": slug]
            )
            guard let result else {
                error = "Workout not found"
                isLoading = false
                return
            }
            workout = result

            let related: [WorkoutCard] = try await convex.query(
                "libraryWorkouts:getRelated",
                args: ["slug": slug, "limit": 4]
            )
            relatedWorkouts = related
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
}

// MARK: - Main Content

private struct WorkoutDetailContent: View {
    let workout: LibraryWorkout
    let relatedWorkouts: [WorkoutCard]

    var body: some View {
        LazyVStack(alignment: .leading, spacing: Theme.Spacing.lg) {
            HeaderSection(workout: workout)
            QuickStatsBar(workout: workout)
            DescriptionSection(workout: workout)
            EquipmentSection(equipment: workout.equipmentNeeded)
            ExerciseBlocksSection(
                blocks: workout.blocks,
                movementDetails: workout.movementDetails,
                restGuidance: workout.restGuidance
            )
            RationaleSection(rationale: workout.workoutRationale)
            FAQSection(items: workout.faq ?? [])
            RelatedWorkoutsSection(workouts: relatedWorkouts)
        }
        .padding(.horizontal, Theme.Spacing.md)
        .padding(.vertical, Theme.Spacing.lg)
    }
}

// MARK: - Header

private struct HeaderSection: View {
    let workout: LibraryWorkout

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text(workout.title)
                .font(Theme.Typography.title)
                .foregroundStyle(Theme.Colors.textPrimary)

            HStack(spacing: Theme.Spacing.xs) {
                BadgePill(
                    text: WorkoutLabels.sessionTypeLabel(workout.sessionType),
                    color: Theme.Colors.sessionTypeColor(workout.sessionType)
                )
                BadgePill(text: WorkoutLabels.goalLabel(workout.goal), color: Theme.Colors.primary)
                BadgePill(text: workout.level.capitalized, color: Theme.Colors.textTertiary)
            }
        }
    }
}

// MARK: - Floating "Open in Tonal" CTA

/// Sticky bottom CTA with gradient backdrop and haptic feedback.
/// This is the primary conversion action of the entire app.
private struct FloatingTonalCTA: View {
    let url: String

    var body: some View {
        VStack(spacing: 0) {
            // Gradient fade from transparent to background
            LinearGradient(
                colors: [Theme.Colors.background.opacity(0), Theme.Colors.background],
                startPoint: .top,
                endPoint: .bottom
            )
            .frame(height: 24)

            HStack(spacing: Theme.Spacing.sm) {
                Button(action: {
                    UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                    TonalDeepLink.openInTonal(url: url)
                }) {
                    HStack(spacing: Theme.Spacing.sm) {
                        Image(systemName: "arrow.up.right.square.fill")
                            .font(.system(size: 20, weight: .semibold))
                        Text("Open in Tonal")
                            .font(.system(size: 17, weight: .bold))
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
                    .background(
                        LinearGradient(
                            colors: [Theme.Colors.primary, Theme.Colors.primary.opacity(0.85)],
                            startPoint: .leading,
                            endPoint: .trailing
                        )
                    )
                    .foregroundStyle(Theme.Colors.primaryForeground)
                    .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.lg, style: .continuous))
                    .shadow(color: Theme.Colors.primary.opacity(0.3), radius: 12, y: 4)
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, Theme.Spacing.lg)
            .padding(.bottom, Theme.Spacing.sm)
            .background(Theme.Colors.background)
        }
    }
}

// MARK: - Quick Stats

private struct QuickStatsBar: View {
    let workout: LibraryWorkout

    var body: some View {
        HStack(spacing: Theme.Spacing.sm) {
            StatBadgeView(icon: "clock", value: "\(workout.durationMinutes)m", label: "Duration")
            StatBadgeView(icon: "dumbbell", value: "\(workout.exerciseCount)", label: "Exercises")
            StatBadgeView(icon: "chart.bar", value: "\(workout.totalSets)", label: "Sets")
            StatBadgeView(
                icon: "figure.strengthtraining.traditional",
                value: workout.targetMuscleGroups.prefix(2).joined(separator: ", "),
                label: "Muscles"
            )
        }
    }
}

private struct StatBadgeView: View {
    let icon: String
    let value: String
    let label: String

    var body: some View {
        VStack(spacing: 6) {
            Image(systemName: icon)
                .font(.system(size: 14))
                .foregroundStyle(Theme.Colors.textTertiary)
            Text(value)
                .font(Theme.Typography.headline)
                .foregroundStyle(Theme.Colors.textPrimary)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            Text(label)
                .font(Theme.Typography.caption)
                .foregroundStyle(Theme.Colors.textTertiary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Theme.Spacing.sm)
        .background(Theme.Colors.card)
        .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.md))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.CornerRadius.md)
                .stroke(Theme.Colors.border, lineWidth: 1)
        )
    }
}

// MARK: - Description

private struct DescriptionSection: View {
    let workout: LibraryWorkout

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text(workout.description)
                .font(Theme.Typography.body)
                .foregroundStyle(Theme.Colors.textSecondary)

            if let who = workout.whoIsThisFor {
                Text(who)
                    .font(Theme.Typography.caption)
                    .italic()
                    .foregroundStyle(Theme.Colors.textTertiary)
            }
        }
    }
}

// MARK: - Equipment

private struct EquipmentSection: View {
    let equipment: [String]

    var body: some View {
        if !equipment.isEmpty {
            VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
                Text("EQUIPMENT")
                    .font(Theme.Typography.caption)
                    .foregroundStyle(Theme.Colors.textTertiary)
                    .tracking(0.8)

                FlowLayout(spacing: 6) {
                    ForEach(equipment, id: \.self) { item in
                        Text(item)
                            .font(Theme.Typography.caption)
                            .foregroundStyle(Theme.Colors.textSecondary)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(Theme.Colors.card)
                            .clipShape(Capsule())
                            .overlay(Capsule().stroke(Theme.Colors.border, lineWidth: 1))
                    }
                }
            }
        }
    }
}

/// Simple horizontal wrapping layout for badge pills.
private struct FlowLayout: Layout {
    var spacing: CGFloat = 6

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache _: inout ()) -> CGSize {
        let rows = computeRows(proposal: proposal, subviews: subviews)
        let height = rows.reduce(CGFloat.zero) { total, row in
            total + row.height + (total > 0 ? spacing : 0)
        }
        return CGSize(width: proposal.width ?? 0, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache _: inout ()) {
        let rows = computeRows(proposal: proposal, subviews: subviews)
        var y = bounds.minY
        var subviewIndex = 0
        for row in rows {
            var x = bounds.minX
            for _ in 0..<row.count {
                let size = subviews[subviewIndex].sizeThatFits(.unspecified)
                subviews[subviewIndex].place(at: CGPoint(x: x, y: y), proposal: .unspecified)
                x += size.width + spacing
                subviewIndex += 1
            }
            y += row.height + spacing
        }
    }

    private struct Row {
        var count: Int
        var height: CGFloat
    }

    private func computeRows(proposal: ProposedViewSize, subviews: Subviews) -> [Row] {
        let maxWidth = proposal.width ?? .infinity
        var rows: [Row] = []
        var currentWidth: CGFloat = 0
        var currentHeight: CGFloat = 0
        var currentCount = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            let neededWidth = currentCount > 0 ? size.width + spacing : size.width
            if currentWidth + neededWidth > maxWidth, currentCount > 0 {
                rows.append(Row(count: currentCount, height: currentHeight))
                currentWidth = size.width
                currentHeight = size.height
                currentCount = 1
            } else {
                currentWidth += neededWidth
                currentHeight = max(currentHeight, size.height)
                currentCount += 1
            }
        }
        if currentCount > 0 {
            rows.append(Row(count: currentCount, height: currentHeight))
        }
        return rows
    }
}

// MARK: - Exercise Blocks

private struct ExerciseBlocksSection: View {
    let blocks: [WorkoutBlock]
    let movementDetails: [MovementDetail]
    let restGuidance: String?

    private var detailMap: [String: MovementDetail] {
        Dictionary(movementDetails.map { ($0.movementId, $0) }, uniquingKeysWith: { first, _ in first })
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.md) {
            Text("Workout Plan")
                .font(Theme.Typography.title2)
                .foregroundStyle(Theme.Colors.textPrimary)

            if let restGuidance {
                Text(restGuidance)
                    .font(Theme.Typography.caption)
                    .foregroundStyle(Theme.Colors.textSecondary)
                    .padding(Theme.Spacing.sm)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Theme.Colors.card.opacity(0.5))
                    .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.md))
                    .overlay(
                        RoundedRectangle(cornerRadius: Theme.CornerRadius.md)
                            .stroke(Theme.Colors.border, lineWidth: 1)
                    )
            }

            ForEach(Array(blocks.enumerated()), id: \.offset) { index, block in
                BlockCard(block: block, index: index, detailMap: detailMap)
            }
        }
    }
}

private struct BlockCard: View {
    let block: WorkoutBlock
    let index: Int
    let detailMap: [String: MovementDetail]

    private var isSuperset: Bool { block.exercises.count >= 2 }

    private var blockLabel: String {
        if let first = block.exercises.first,
           let detail = detailMap[first.movementId],
           let accessory = detail.accessory
        {
            return accessory
        }
        return "Block \(index + 1)"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            BlockHeaderView(label: blockLabel, isSuperset: isSuperset)
                .padding(.horizontal, Theme.Spacing.sm)
                .padding(.top, Theme.Spacing.sm)
                .padding(.bottom, Theme.Spacing.xs)

            ForEach(block.exercises, id: \.movementId) { exercise in
                let detail = detailMap[exercise.movementId]
                ExerciseRowView(exercise: exercise, detail: detail)
            }
        }
        .background(Theme.Colors.card)
        .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.md))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.CornerRadius.md)
                .stroke(Theme.Colors.border, lineWidth: 1)
        )
    }
}

private struct BlockHeaderView: View {
    let label: String
    let isSuperset: Bool

    var body: some View {
        HStack(spacing: Theme.Spacing.xs) {
            Text(label)
                .font(Theme.Typography.headline)
                .foregroundStyle(Theme.Colors.textPrimary)

            if isSuperset {
                Text("Superset")
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(Theme.Colors.textTertiary)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(Theme.Colors.background)
                    .clipShape(Capsule())
            }

            Spacer()
        }
    }
}

private struct ExerciseRowView: View {
    let exercise: BlockExercise
    let detail: MovementDetail?

    private var name: String { detail?.name ?? exercise.movementId }
    private var sets: Int { detail?.sets ?? exercise.sets }
    private var reps: Int? { detail?.reps ?? exercise.reps }
    private var duration: Int? { detail?.duration ?? exercise.duration }
    private var muscles: [String] { detail?.muscleGroups ?? [] }

    private var setRepLabel: String {
        if let duration { return "\(sets) x \(duration)s" }
        if let reps { return "\(sets) x \(reps)" }
        return "\(sets) sets"
    }

    var body: some View {
        HStack(spacing: Theme.Spacing.sm) {
            // Thumbnail
            if let url = detail?.thumbnailMediaUrl, let imageURL = URL(string: url) {
                AsyncImage(url: imageURL) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                    default:
                        thumbnailPlaceholder
                    }
                }
                .frame(width: 48, height: 48)
                .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.sm))
            } else {
                thumbnailPlaceholder
            }

            // Name, muscles, coaching cue
            VStack(alignment: .leading, spacing: 2) {
                Text(name)
                    .font(Theme.Typography.body)
                    .foregroundStyle(Theme.Colors.textPrimary)
                    .lineLimit(1)

                if !muscles.isEmpty {
                    Text(muscles.joined(separator: ", "))
                        .font(Theme.Typography.caption)
                        .foregroundStyle(Theme.Colors.textTertiary)
                        .lineLimit(1)
                }

                if let cue = detail?.coachingCue {
                    Text(cue)
                        .font(.system(size: 11))
                        .italic()
                        .foregroundStyle(Theme.Colors.primary.opacity(0.7))
                        .lineLimit(2)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            // Sets x reps
            Text(setRepLabel)
                .font(Theme.Typography.body)
                .monospacedDigit()
                .foregroundStyle(Theme.Colors.textSecondary)
        }
        .padding(.horizontal, Theme.Spacing.sm)
        .padding(.vertical, Theme.Spacing.xs)
    }

    private var thumbnailPlaceholder: some View {
        RoundedRectangle(cornerRadius: Theme.CornerRadius.sm)
            .fill(Theme.Colors.background)
            .frame(width: 48, height: 48)
    }
}

// MARK: - Rationale

private struct RationaleSection: View {
    let rationale: String?

    var body: some View {
        if let rationale {
            VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
                Text("Why this order")
                    .font(Theme.Typography.headline)
                    .foregroundStyle(Theme.Colors.textPrimary)

                Text(rationale)
                    .font(Theme.Typography.caption)
                    .foregroundStyle(Theme.Colors.textSecondary)
            }
            .padding(Theme.Spacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Colors.card)
            .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.md))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.CornerRadius.md)
                    .stroke(Theme.Colors.border, lineWidth: 1)
            )
        }
    }
}

// MARK: - FAQ

private struct FAQSection: View {
    let items: [FAQ]

    var body: some View {
        if !items.isEmpty {
            VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
                Text("Frequently Asked Questions")
                    .font(Theme.Typography.title2)
                    .foregroundStyle(Theme.Colors.textPrimary)

                ForEach(items) { item in
                    FAQItemView(item: item)
                }
            }
        }
    }
}

private struct FAQItemView: View {
    let item: FAQ
    @State private var isExpanded = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button(action: { withAnimation(.easeInOut(duration: 0.2)) { isExpanded.toggle() } }) {
                HStack {
                    Text(item.question)
                        .font(Theme.Typography.headline)
                        .foregroundStyle(Theme.Colors.textPrimary)
                        .multilineTextAlignment(.leading)

                    Spacer()

                    Image(systemName: "chevron.down")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Theme.Colors.textTertiary)
                        .rotationEffect(.degrees(isExpanded ? 180 : 0))
                }
                .padding(Theme.Spacing.md)
            }
            .buttonStyle(.plain)

            if isExpanded {
                Text(item.answer)
                    .font(Theme.Typography.caption)
                    .foregroundStyle(Theme.Colors.textSecondary)
                    .padding(.horizontal, Theme.Spacing.md)
                    .padding(.bottom, Theme.Spacing.md)
                    .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .background(Theme.Colors.card)
        .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.md))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.CornerRadius.md)
                .stroke(Theme.Colors.border, lineWidth: 1)
        )
    }
}

// MARK: - Related Workouts

private struct RelatedWorkoutsSection: View {
    let workouts: [WorkoutCard]

    var body: some View {
        if !workouts.isEmpty {
            VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
                Text("Related Workouts")
                    .font(Theme.Typography.title2)
                    .foregroundStyle(Theme.Colors.textPrimary)

                ScrollView(.horizontal, showsIndicators: false) {
                    LazyHStack(spacing: Theme.Spacing.sm) {
                        ForEach(workouts) { workout in
                            NavigationLink(value: workout) {
                                WorkoutCardView(workout: workout)
                            }
                            .buttonStyle(CardButtonStyle())
                            .frame(width: 260)
                        }
                    }
                    .padding(.horizontal, 1) // prevent clipping of card shadows
                }
            }
        }
    }
}

// MARK: - Badge Pill

private struct BadgePill: View {
    let text: String
    let color: Color

    var body: some View {
        Text(text)
            .font(.system(size: 12, weight: .medium))
            .foregroundStyle(color)
            .padding(.horizontal, 10)
            .padding(.vertical, 4)
            .background(color.opacity(0.15))
            .clipShape(Capsule())
    }
}

// MARK: - Loading Skeleton

private struct WorkoutDetailSkeleton: View {
    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.lg) {
            // Title placeholder
            SkeletonRect(height: 28, width: 240)
            // Badges
            HStack(spacing: Theme.Spacing.xs) {
                SkeletonRect(height: 24, width: 60)
                SkeletonRect(height: 24, width: 80)
                SkeletonRect(height: 24, width: 70)
            }
            // CTA button
            SkeletonRect(height: 48)
            // Stats row
            HStack(spacing: Theme.Spacing.sm) {
                ForEach(0..<4, id: \.self) { _ in
                    SkeletonRect(height: 80)
                }
            }
            // Description
            SkeletonRect(height: 14)
            SkeletonRect(height: 14, width: 200)
            // Exercise blocks
            ForEach(0..<3, id: \.self) { _ in
                SkeletonRect(height: 120)
            }
        }
        .padding(.horizontal, Theme.Spacing.md)
        .padding(.vertical, Theme.Spacing.lg)
    }
}

private struct SkeletonRect: View {
    var height: CGFloat
    var width: CGFloat? = nil

    var body: some View {
        RoundedRectangle(cornerRadius: Theme.CornerRadius.sm)
            .fill(Theme.Colors.card)
            .frame(maxWidth: width ?? .infinity)
            .frame(height: height)
            .shimmer()
    }
}

/// Shimmer animation modifier for skeleton loading states.
private struct ShimmerModifier: ViewModifier {
    @State private var phase: CGFloat = -1

    func body(content: Content) -> some View {
        content
            .overlay(
                LinearGradient(
                    colors: [.clear, Theme.Colors.border.opacity(0.3), .clear],
                    startPoint: .leading,
                    endPoint: .trailing
                )
                .offset(x: phase * 300)
                .mask(content)
            )
            .onAppear {
                withAnimation(.linear(duration: 1.5).repeatForever(autoreverses: false)) {
                    phase = 1
                }
            }
    }
}

private extension View {
    func shimmer() -> some View {
        modifier(ShimmerModifier())
    }
}

// MARK: - Error State

private struct WorkoutDetailError: View {
    let message: String
    let onRetry: () -> Void

    var body: some View {
        VStack(spacing: Theme.Spacing.md) {
            Spacer()

            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 40))
                .foregroundStyle(Theme.Colors.textTertiary)

            Text(message)
                .font(Theme.Typography.body)
                .foregroundStyle(Theme.Colors.textSecondary)
                .multilineTextAlignment(.center)

            Button("Try Again", action: onRetry)
                .font(Theme.Typography.headline)
                .foregroundStyle(Theme.Colors.primary)

            Spacer()
        }
        .frame(maxWidth: .infinity)
        .padding(Theme.Spacing.lg)
    }
}

// Label helpers delegate to WorkoutLabels (defined in WorkoutCardView.swift)
// to avoid duplication across files.
