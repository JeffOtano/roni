import SwiftUI
import ConvexMobile

// MARK: - Goal Option

private struct GoalOption: Identifiable {
    let id: String
    let label: String
    let icon: String

    static let all: [GoalOption] = [
        GoalOption(id: "build_muscle", label: "Build Muscle", icon: "figure.strengthtraining.traditional"),
        GoalOption(id: "get_stronger", label: "Get Stronger", icon: "bolt.fill"),
        GoalOption(id: "lose_fat", label: "Lose Fat / Recomp", icon: "flame.fill"),
        GoalOption(id: "general_fitness", label: "General Fitness", icon: "heart.fill"),
    ]
}

// MARK: - Split Option

private struct SplitOption: Identifiable {
    let id: String
    let label: String
    let subtitle: String

    static let all: [SplitOption] = [
        SplitOption(id: "ppl", label: "Push / Pull / Legs", subtitle: "Classic bodybuilding split"),
        SplitOption(id: "upper_lower", label: "Upper / Lower", subtitle: "Alternating upper and lower body"),
        SplitOption(id: "full_body", label: "Full Body", subtitle: "Hit everything each session"),
    ]
}

// MARK: - Training Preferences View

/// Step 2 of onboarding: collects training goal, days per week, session duration,
/// split preference, and optional injuries. Calls `userProfiles:completeOnboarding`
/// on submit and advances the flow.
struct TrainingPreferencesView: View {
    let onComplete: () -> Void

    @Environment(ConvexManager.self) private var convex

    @State private var selectedGoal = ""
    @State private var daysPerWeek = 3
    @State private var selectedDuration = 45
    @State private var selectedSplit = "ppl"
    @State private var injuries = ""
    @State private var isSaving = false
    @State private var errorMessage: String?

    @FocusState private var isInjuriesFocused: Bool

    private let daysOptions = [2, 3, 4, 5]
    private let durationOptions = [30, 45, 60]

    private var canSubmit: Bool {
        !selectedGoal.isEmpty && !isSaving
    }

    // MARK: - Body

    var body: some View {
        ZStack {
            Theme.Colors.background
                .ignoresSafeArea()
                .onTapGesture { isInjuriesFocused = false }

            VStack(spacing: 0) {
                ScrollView {
                    VStack(spacing: Theme.Spacing.xl) {
                        stepIndicator
                        headerSection
                        goalSection
                        daysSection
                        durationSection
                        splitSection
                        injuriesSection
                        errorBanner
                    }
                    .padding(.horizontal, Theme.Spacing.lg)
                    .padding(.top, Theme.Spacing.xl)
                    .padding(.bottom, Theme.Spacing.xxxl)
                }

                continueButton
            }
        }
    }

    // MARK: - Step Indicator

    private var stepIndicator: some View {
        VStack(spacing: Theme.Spacing.sm) {
            Text("Step 2 of 3")
                .font(Theme.Typography.caption)
                .foregroundStyle(Theme.Colors.textSecondary)

            HStack(spacing: Theme.Spacing.sm) {
                ForEach(1...3, id: \.self) { step in
                    Circle()
                        .fill(step <= 2 ? Theme.Colors.primary : Theme.Colors.tertiaryForeground)
                        .frame(width: 8, height: 8)
                }
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Step 2 of 3")
    }

    // MARK: - Header

    private var headerSection: some View {
        VStack(spacing: Theme.Spacing.sm) {
            Text("Set Your Preferences")
                .font(Theme.Typography.title)
                .foregroundStyle(Theme.Colors.textPrimary)
                .accessibilityAddTraits(.isHeader)

            Text("A few quick questions so I can program your first AI workout.")
                .font(Theme.Typography.callout)
                .foregroundStyle(Theme.Colors.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, Theme.Spacing.md)
        }
    }

    // MARK: - Goal Selection

    private var goalSection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text("What's your main goal?")
                .font(Theme.Typography.calloutMedium)
                .foregroundStyle(Theme.Colors.textSecondary)

            VStack(spacing: Theme.Spacing.sm) {
                ForEach(GoalOption.all) { goal in
                    goalCard(goal)
                }
            }
        }
    }

    private func goalCard(_ goal: GoalOption) -> some View {
        let isSelected = selectedGoal == goal.id

        return Button {
            withAnimation(.easeInOut(duration: 0.15)) {
                selectedGoal = goal.id
            }
            Theme.Haptics.selection()
        } label: {
            HStack(spacing: Theme.Spacing.md) {
                Image(systemName: goal.icon)
                    .font(.system(size: 18))
                    .foregroundStyle(isSelected ? Theme.Colors.primary : Theme.Colors.textSecondary)
                    .frame(width: 24, alignment: .center)

                Text(goal.label)
                    .font(Theme.Typography.callout)
                    .foregroundStyle(Theme.Colors.textPrimary)

                Spacer()

                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 20))
                        .foregroundStyle(Theme.Colors.primary)
                        .transition(.scale.combined(with: .opacity))
                }
            }
            .padding(.horizontal, Theme.Spacing.md)
            .padding(.vertical, Theme.Spacing.md)
            .background(Theme.Colors.card)
            .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.lg, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.CornerRadius.lg, style: .continuous)
                    .stroke(
                        isSelected ? Theme.Colors.primary : Theme.Colors.border,
                        lineWidth: 1
                    )
            )
        }
        .accessibilityLabel(goal.label)
        .accessibilityAddTraits(isSelected ? [.isSelected] : [])
    }

    // MARK: - Days Per Week

    private var daysSection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text("How many days do you train?")
                .font(Theme.Typography.calloutMedium)
                .foregroundStyle(Theme.Colors.textSecondary)

            HStack(spacing: Theme.Spacing.sm) {
                ForEach(daysOptions, id: \.self) { day in
                    chipButton(
                        label: "\(day) days",
                        isSelected: daysPerWeek == day
                    ) {
                        daysPerWeek = day
                    }
                }
            }
        }
    }

    // MARK: - Session Duration

    private var durationSection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text("Preferred workout length?")
                .font(Theme.Typography.calloutMedium)
                .foregroundStyle(Theme.Colors.textSecondary)

            HStack(spacing: Theme.Spacing.sm) {
                ForEach(durationOptions, id: \.self) { duration in
                    chipButton(
                        label: "\(duration) min",
                        isSelected: selectedDuration == duration
                    ) {
                        selectedDuration = duration
                    }
                }
            }
        }
    }

    // MARK: - Split Preference

    private var splitSection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            Text("Preferred training split?")
                .font(Theme.Typography.calloutMedium)
                .foregroundStyle(Theme.Colors.textSecondary)

            VStack(spacing: Theme.Spacing.sm) {
                ForEach(SplitOption.all) { split in
                    splitCard(split)
                }
            }
        }
    }

    private func splitCard(_ split: SplitOption) -> some View {
        let isSelected = selectedSplit == split.id

        return Button {
            withAnimation(.easeInOut(duration: 0.15)) {
                selectedSplit = split.id
            }
            Theme.Haptics.selection()
        } label: {
            HStack(spacing: Theme.Spacing.md) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(split.label)
                        .font(Theme.Typography.callout)
                        .foregroundStyle(Theme.Colors.textPrimary)

                    Text(split.subtitle)
                        .font(Theme.Typography.caption)
                        .foregroundStyle(Theme.Colors.textTertiary)
                }

                Spacer()

                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 20))
                        .foregroundStyle(Theme.Colors.primary)
                        .transition(.scale.combined(with: .opacity))
                }
            }
            .padding(.horizontal, Theme.Spacing.md)
            .padding(.vertical, Theme.Spacing.md)
            .background(Theme.Colors.card)
            .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.lg, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.CornerRadius.lg, style: .continuous)
                    .stroke(
                        isSelected ? Theme.Colors.primary : Theme.Colors.border,
                        lineWidth: 1
                    )
            )
        }
        .accessibilityLabel("\(split.label), \(split.subtitle)")
        .accessibilityAddTraits(isSelected ? [.isSelected] : [])
    }

    // MARK: - Injuries

    private var injuriesSection: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            HStack {
                Text("Any injuries or areas to avoid?")
                    .font(Theme.Typography.calloutMedium)
                    .foregroundStyle(Theme.Colors.textSecondary)

                Spacer()

                Text("Optional")
                    .font(Theme.Typography.caption)
                    .foregroundStyle(Theme.Colors.textTertiary)
            }

            TextEditor(text: $injuries)
                .font(Theme.Typography.callout)
                .foregroundStyle(Theme.Colors.textPrimary)
                .scrollContentBackground(.hidden)
                .focused($isInjuriesFocused)
                .frame(minHeight: 80, maxHeight: 120)
                .padding(.horizontal, Theme.Spacing.sm)
                .padding(.vertical, Theme.Spacing.sm)
                .background(Theme.Colors.card)
                .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.lg, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.CornerRadius.lg, style: .continuous)
                        .stroke(
                            isInjuriesFocused ? Theme.Colors.ring : Theme.Colors.border,
                            lineWidth: 1
                        )
                )
                .overlay(alignment: .topLeading) {
                    if injuries.isEmpty && !isInjuriesFocused {
                        Text("e.g. lower back, right shoulder...")
                            .font(Theme.Typography.callout)
                            .foregroundStyle(Theme.Colors.tertiaryForeground)
                            .padding(.horizontal, Theme.Spacing.md)
                            .padding(.vertical, Theme.Spacing.md)
                            .allowsHitTesting(false)
                    }
                }
                .onChange(of: injuries) { _, newValue in
                    if newValue.count > 200 {
                        injuries = String(newValue.prefix(200))
                    }
                }
                .accessibilityLabel("Injuries or areas to avoid")

            if !injuries.isEmpty {
                Text("\(injuries.count)/200")
                    .font(Theme.Typography.caption)
                    .foregroundStyle(Theme.Colors.textTertiary)
                    .frame(maxWidth: .infinity, alignment: .trailing)
            }
        }
    }

    // MARK: - Error Banner

    @ViewBuilder
    private var errorBanner: some View {
        if let errorMessage {
            HStack(spacing: Theme.Spacing.sm) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.system(size: 14))

                Text(errorMessage)
                    .font(Theme.Typography.callout)
                    .multilineTextAlignment(.leading)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .foregroundStyle(Theme.Colors.destructive)
            .padding(Theme.Spacing.md)
            .background(Theme.Colors.destructive.opacity(0.12))
            .clipShape(
                RoundedRectangle(cornerRadius: Theme.CornerRadius.md, style: .continuous)
            )
            .overlay(
                RoundedRectangle(cornerRadius: Theme.CornerRadius.md, style: .continuous)
                    .stroke(Theme.Colors.destructive.opacity(0.25), lineWidth: 1)
            )
            .transition(.move(edge: .top).combined(with: .opacity))
            .accessibilityElement(children: .combine)
            .accessibilityLabel("Error: \(errorMessage)")
        }
    }

    // MARK: - Continue Button

    private var continueButton: some View {
        VStack(spacing: Theme.Spacing.md) {
            Divider()
                .background(Theme.Colors.border)

            Button {
                save()
            } label: {
                Group {
                    if isSaving {
                        ProgressView()
                            .tint(Theme.Colors.primaryForeground)
                    } else {
                        Text("Continue")
                    }
                }
                .font(Theme.Typography.calloutMedium)
                .foregroundStyle(Theme.Colors.primaryForeground)
                .frame(maxWidth: .infinity)
                .frame(height: 48)
                .background(
                    canSubmit
                        ? Theme.Colors.primary
                        : Theme.Colors.primary.opacity(0.4)
                )
                .clipShape(
                    RoundedRectangle(cornerRadius: Theme.CornerRadius.md, style: .continuous)
                )
            }
            .disabled(!canSubmit)
            .accessibilityLabel(isSaving ? "Saving preferences" : "Continue")
        }
        .padding(.horizontal, Theme.Spacing.lg)
        .padding(.bottom, Theme.Spacing.lg)
    }

    // MARK: - Chip Button

    private func chipButton(label: String, isSelected: Bool, action: @escaping () -> Void) -> some View {
        Button {
            withAnimation(.easeInOut(duration: 0.15)) {
                action()
            }
            Theme.Haptics.selection()
        } label: {
            Text(label)
                .font(Theme.Typography.calloutMedium)
                .foregroundStyle(isSelected ? Theme.Colors.primaryForeground : Theme.Colors.textSecondary)
                .padding(.horizontal, Theme.Spacing.lg)
                .padding(.vertical, Theme.Spacing.md)
                .frame(maxWidth: .infinity)
                .background(isSelected ? Theme.Colors.primary : Theme.Colors.card)
                .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.md, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: Theme.CornerRadius.md, style: .continuous)
                        .stroke(
                            isSelected ? Theme.Colors.primary : Theme.Colors.border,
                            lineWidth: 1
                        )
                )
        }
        .accessibilityLabel(label)
        .accessibilityAddTraits(isSelected ? [.isSelected] : [])
    }

    // MARK: - Save Action

    private func save() {
        guard canSubmit else { return }
        isInjuriesFocused = false
        isSaving = true
        errorMessage = nil

        Task {
            do {
                try await convex.mutation(
                    "userProfiles:completeOnboarding",
                    with: [
                        "goal": selectedGoal,
                        "injuries": injuries.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                            ? nil : injuries.trimmingCharacters(in: .whitespacesAndNewlines),
                        "preferredSplit": selectedSplit,
                        "trainingDays": trainingDayIndices(for: daysPerWeek),
                        "sessionDurationMinutes": Double(selectedDuration),
                    ]
                )
                Theme.Haptics.success()
                onComplete()
            } catch {
                isSaving = false
                withAnimation(.easeInOut(duration: 0.25)) {
                    errorMessage = "Failed to save preferences. Please try again."
                }
                Theme.Haptics.error()
            }
        }
    }

    // MARK: - Training Day Indices

    /// Computes which days of the week to train, matching the web's `getTrainingDayIndices`.
    /// 0 = Monday, 6 = Sunday.
    private func trainingDayIndices(for days: Int) -> [ConvexEncodable?] {
        let indices: [Int]
        switch days {
        case 2: indices = [0, 3]
        case 3: indices = [0, 2, 4]
        case 4: indices = [0, 2, 4, 6]
        case 5: indices = [0, 1, 3, 4, 6]
        default: indices = [0, 2, 4]
        }
        return indices.map { Double($0) as ConvexEncodable? }
    }
}

// MARK: - Preview

#Preview("Training Preferences") {
    TrainingPreferencesView(onComplete: {})
        .environment(ConvexManager())
        .preferredColorScheme(.dark)
}
