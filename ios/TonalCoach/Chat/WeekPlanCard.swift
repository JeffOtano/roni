import SwiftUI

// MARK: - Week Plan Card

/// Renders a coach-generated weekly training plan as a structured card with day tabs.
///
/// Extracts `week-plan` JSON code blocks from coach messages and displays them
/// as a tabbed exercise table instead of raw JSON. Mirrors the web's `WeekPlanCard.tsx`.
struct WeekPlanCard: View {
    let plan: WeekPlanPresentation

    @State private var activeDay = 0

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header
            dayTabs
            if let day = plan.days[safe: activeDay] {
                exerciseTable(day)
            }
            summaryFooter
        }
        .background(Theme.Colors.card)
        .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.lg, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: Theme.CornerRadius.lg, style: .continuous)
                .stroke(Theme.Colors.border, lineWidth: 1)
        )
    }

    // MARK: - Header

    private var header: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text("Week of \(plan.weekStartDate)")
                .font(Theme.Typography.cardTitle)
                .foregroundStyle(Theme.Colors.textPrimary)
            Text(plan.splitLabel)
                .font(Theme.Typography.caption)
                .foregroundStyle(Theme.Colors.textSecondary)
        }
        .padding(.horizontal, Theme.Spacing.md)
        .padding(.vertical, Theme.Spacing.sm)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Colors.muted.opacity(0.3))
        .overlay(alignment: .bottom) {
            Theme.Colors.border.frame(height: 1)
        }
    }

    // MARK: - Day Tabs

    private var dayTabs: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Theme.Spacing.xs) {
                ForEach(Array(plan.days.enumerated()), id: \.offset) { index, day in
                    Button {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            activeDay = index
                        }
                    } label: {
                        Text(day.dayName)
                            .font(Theme.Typography.calloutMedium)
                            .foregroundStyle(
                                index == activeDay
                                    ? Theme.Colors.primaryForeground
                                    : Theme.Colors.textSecondary
                            )
                            .padding(.horizontal, Theme.Spacing.md)
                            .padding(.vertical, Theme.Spacing.xs)
                            .background(
                                index == activeDay
                                    ? Theme.Colors.primary
                                    : Color.clear
                            )
                            .clipShape(RoundedRectangle(cornerRadius: Theme.CornerRadius.sm, style: .continuous))
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, Theme.Spacing.sm)
            .padding(.vertical, Theme.Spacing.xs)
        }
        .overlay(alignment: .bottom) {
            Theme.Colors.border.frame(height: 1)
        }
    }

    // MARK: - Exercise Table

    private func exerciseTable(_ day: WeekPlanDay) -> some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            // Session info
            Text("\(day.sessionType)  \u{00B7}  \(day.targetMuscles)  \u{00B7}  \(day.durationMinutes)min")
                .font(Theme.Typography.caption)
                .foregroundStyle(Theme.Colors.textSecondary)

            // Column headers
            HStack {
                Text("Exercise")
                    .frame(maxWidth: .infinity, alignment: .leading)
                Text("Sets")
                    .frame(width: 50, alignment: .center)
                Text("Target")
                    .frame(width: 55, alignment: .trailing)
                Text("Last")
                    .frame(width: 50, alignment: .trailing)
            }
            .font(Theme.Typography.caption)
            .foregroundStyle(Theme.Colors.textTertiary)

            // Exercise rows
            ForEach(day.exercises) { exercise in
                exerciseRow(exercise)
            }
        }
        .padding(Theme.Spacing.md)
    }

    private func exerciseRow(_ exercise: WeekPlanExercise) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 1) {
                    Text(exercise.name)
                        .font(Theme.Typography.callout)
                        .fontWeight(.medium)
                        .foregroundStyle(Theme.Colors.textPrimary)
                    if let note = exercise.note {
                        Text(note)
                            .font(Theme.Typography.caption)
                            .foregroundStyle(noteColor(note))
                            .lineLimit(2)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                Text(exercise.setsRepsLabel)
                    .font(Theme.Typography.callout)
                    .foregroundStyle(Theme.Colors.textSecondary)
                    .frame(width: 50, alignment: .center)

                Text(exercise.targetWeight.map { "\($0) lbs" } ?? "-")
                    .font(Theme.Typography.callout)
                    .fontWeight(exercise.targetWeight != nil ? .medium : .regular)
                    .foregroundStyle(Theme.Colors.textPrimary)
                    .frame(width: 55, alignment: .trailing)

                Text(exercise.lastWeight.map { "\($0) lbs" } ?? "-")
                    .font(Theme.Typography.callout)
                    .foregroundStyle(Theme.Colors.textSecondary)
                    .frame(width: 50, alignment: .trailing)
            }

            Divider()
                .foregroundStyle(Theme.Colors.border.opacity(0.5))
        }
    }

    // MARK: - Summary Footer

    private var summaryFooter: some View {
        Text(plan.summary)
            .font(Theme.Typography.caption)
            .foregroundStyle(Theme.Colors.textSecondary)
            .lineSpacing(2)
            .padding(.horizontal, Theme.Spacing.md)
            .padding(.vertical, Theme.Spacing.sm)
            .frame(maxWidth: .infinity, alignment: .leading)
            .overlay(alignment: .top) {
                Theme.Colors.border.frame(height: 1)
            }
    }

    // MARK: - Helpers

    private func noteColor(_ note: String) -> Color {
        let lower = note.lowercased()
        if lower.contains("pr") { return Theme.Colors.success }
        if lower.contains("plateau") { return Theme.Colors.warning }
        return Theme.Colors.textTertiary
    }
}

// MARK: - Safe Array Index

private extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}

// MARK: - Week Plan Extraction

/// Extracts a `WeekPlanPresentation` from a coach message containing a
/// ` ```week-plan` or ` ```json` code block.
///
/// Returns the parsed plan and the remaining message text (with the JSON block removed),
/// or nil if no valid week plan is found.
func extractWeekPlan(from text: String) -> (plan: WeekPlanPresentation, remainingText: String)? {
    // Prefer the canonical ```week-plan fence tag
    if let result = tryExtractPlan(from: text, pattern: "```week-plan\\s*\\n([\\s\\S]*?)\\n```") {
        return result
    }
    // Fallback: AI sometimes uses ```json
    if let result = tryExtractPlan(from: text, pattern: "```json\\s*\\n([\\s\\S]*?)\\n```") {
        return result
    }
    return nil
}

private func tryExtractPlan(from text: String, pattern: String) -> (plan: WeekPlanPresentation, remainingText: String)? {
    guard let regex = try? NSRegularExpression(pattern: pattern),
          let match = regex.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)),
          let jsonRange = Range(match.range(at: 1), in: text),
          let fullMatchRange = Range(match.range, in: text)
    else { return nil }

    let jsonString = String(text[jsonRange])
    guard let data = jsonString.data(using: .utf8),
          let plan = try? JSONDecoder().decode(WeekPlanPresentation.self, from: data)
    else { return nil }

    let remaining = text.replacingCharacters(in: fullMatchRange, with: "")
        .trimmingCharacters(in: .whitespacesAndNewlines)
    return (plan, remaining)
}
