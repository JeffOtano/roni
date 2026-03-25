import SwiftUI
import UIKit

// MARK: - Theme (Namespace)

/// Design tokens for the TonalCoach iOS app.
/// Dark-mode only. Matches the web app's OKLCH-based dark theme with a blue-tinted zinc palette.
///
/// Web CSS reference: `src/app/globals.css` (`.dark` block)
/// Session type colors: `src/components/schedule/ScheduleDayCard.tsx`
enum Theme {
    // Intentionally caseless -- used as a namespace only.
}

// MARK: - Colors

extension Theme {

    enum Colors {

        // MARK: Backgrounds
        // Web dark theme uses oklch with hue 265 (blue undertone) at varying lightness.

        /// Page background -- oklch(0.115 0.012 265)
        static let background = Color(hex: "040509")

        /// Card / elevated surface -- oklch(0.155 0.012 265)
        static let card = Color(hex: "0a0c11")

        /// Secondary surface (muted areas) -- oklch(0.195 0.01 265)
        static let muted = Color(hex: "13151a")

        /// Slightly lighter surface (secondary) -- oklch(0.2 0.012 265)
        static let secondary = Color(hex: "13161c")

        /// Accent surface (hover states, active rows) -- oklch(0.22 0.012 265)
        static let accent = Color(hex: "181b20")

        /// Popover / sheet background -- oklch(0.17 0.012 265)
        static let popover = Color(hex: "0d0f15")

        /// Sidebar background -- oklch(0.13 0.012 265)
        static let sidebar = Color(hex: "05070c")

        // MARK: Text

        /// Primary text -- oklch(0.96 0.005 265)
        static let foreground = Color(hex: "f0f2f5")

        /// Muted / secondary text -- oklch(0.62 0.012 265)
        static let mutedForeground = Color(hex: "83868e")

        /// Tertiary text -- oklch(0.45 0.008 265)
        static let tertiaryForeground = Color(hex: "53565e")

        // MARK: Semantic text aliases

        /// Primary text alias (matches foreground).
        static let textPrimary = foreground

        /// Secondary text alias (matches mutedForeground).
        static let textSecondary = mutedForeground

        /// Tertiary / hint text alias.
        static let textTertiary = tertiaryForeground

        // MARK: Primary (Teal/Cyan accent)

        /// Primary accent -- oklch(0.78 0.154 195)
        static let primary = Color(hex: "00d5d6")

        /// Primary text on dark -- oklch(0.115 0.02 265)
        static let primaryForeground = Color(hex: "03050c")

        // MARK: Destructive

        /// Destructive/error -- oklch(0.65 0.23 25)
        static let destructive = Color(hex: "fd393f")

        // MARK: Borders
        // Web uses oklch(1 0 0 / 8%) -- pure white at 8% opacity.

        /// Default border -- white 8% opacity
        static let border = Color.white.opacity(0.08)

        /// Input border -- white 12% opacity
        static let input = Color.white.opacity(0.12)

        /// Focus ring -- primary at 40% opacity
        static let ring = Color(hex: "00d5d6").opacity(0.40)

        // MARK: Semantic

        /// Success -- Tailwind green-500
        static let success = Color(hex: "22c55e")

        /// Warning -- Tailwind yellow-500
        static let warning = Color(hex: "eab308")

        /// Error -- same as destructive
        static let error = Color(hex: "fd393f")

        // MARK: Chart colors (from dark theme CSS)

        /// Chart 1 / primary -- oklch(0.78 0.154 195) -- teal
        static let chart1 = Color(hex: "00d5d6")

        /// Chart 2 -- oklch(0.65 0.19 265) -- blue
        static let chart2 = Color(hex: "5587ff")

        /// Chart 3 -- oklch(0.6 0.22 300) -- purple
        static let chart3 = Color(hex: "9754ed")

        /// Chart 4 -- oklch(0.72 0.17 340) -- pink
        static let chart4 = Color(hex: "e875c6")

        /// Chart 5 -- oklch(0.8 0.16 85) -- gold/yellow
        static let chart5 = Color(hex: "edb417")

        // MARK: Session type colors
        // Derived from Tailwind classes in ScheduleDayCard.tsx.

        /// Push -- blue-500
        static let sessionPush = Color(hex: "3b82f6")

        /// Pull -- purple-500
        static let sessionPull = Color(hex: "a855f7")

        /// Legs -- emerald-500
        static let sessionLegs = Color(hex: "10b981")

        /// Upper Body -- orange-400
        static let sessionUpper = Color(hex: "fb923c")

        /// Lower Body -- teal-400
        static let sessionLower = Color(hex: "2dd4bf")

        /// Full Body -- pink-500
        static let sessionFullBody = Color(hex: "ec4899")

        /// Chest -- rose-400
        static let sessionChest = Color(hex: "fb7185")

        /// Back -- sky-500
        static let sessionBack = Color(hex: "0ea5e9")

        /// Shoulders -- amber-500
        static let sessionShoulders = Color(hex: "f59e0b")

        /// Arms -- violet-500
        static let sessionArms = Color(hex: "8b5cf6")

        /// Core -- lime-500
        static let sessionCore = Color(hex: "84cc16")

        /// Glutes & Hamstrings -- fuchsia-500
        static let sessionGlutesHamstrings = Color(hex: "d946ef")

        /// Chest & Back -- cyan-500
        static let sessionChestBack = Color(hex: "06b6d4")

        /// Mobility -- yellow-500
        static let sessionMobility = Color(hex: "eab308")

        /// Recovery -- zinc-400
        static let sessionRecovery = Color(hex: "a1a1aa")

        // MARK: Level indicator colors (from WorkoutLibraryCard.tsx)

        /// Beginner -- emerald-400
        static let levelBeginner = Color(hex: "34d399")

        /// Intermediate -- amber-400
        static let levelIntermediate = Color(hex: "fbbf24")

        /// Advanced -- rose-400
        static let levelAdvanced = Color(hex: "fb7185")

        // MARK: - Session type resolver

        /// Returns the accent color for a given session type string.
        /// Keys match the `LibrarySessionType` union on the backend.
        static func sessionTypeColor(_ type: String) -> Color {
            switch type {
            case "push":              return sessionPush
            case "pull":              return sessionPull
            case "legs":              return sessionLegs
            case "upper":             return sessionUpper
            case "lower":             return sessionLower
            case "full_body":         return sessionFullBody
            case "chest":             return sessionChest
            case "back":              return sessionBack
            case "shoulders":         return sessionShoulders
            case "arms":              return sessionArms
            case "core":              return sessionCore
            case "glutes_hamstrings": return sessionGlutesHamstrings
            case "chest_back":        return sessionChestBack
            case "mobility":          return sessionMobility
            case "recovery":          return sessionRecovery
            default:                  return mutedForeground
            }
        }

        /// Returns the color for a workout difficulty level.
        static func levelColor(_ level: String) -> Color {
            switch level {
            case "beginner":     return levelBeginner
            case "intermediate": return levelIntermediate
            case "advanced":     return levelAdvanced
            default:             return mutedForeground
            }
        }
    }
}

// MARK: - Typography

extension Theme {

    /// Typography using DM Sans (body) and Geist Mono (code/numbers),
    /// matching the web app's font stack exactly.
    ///
    /// Fonts are bundled as variable TTFs and registered via Info.plist UIAppFonts.
    /// Falls back to SF Pro if custom fonts fail to load.
    enum Typography {

        // MARK: Font Families

        /// DM Sans family name as registered by iOS from the variable font.
        private static let sansFamily = "DM Sans"
        /// Geist Mono family name.
        private static let monoFamily = "Geist Mono"

        // MARK: Helpers

        private static func sans(size: CGFloat, weight: Font.Weight) -> Font {
            .custom(sansFamily, size: size).weight(weight)
        }

        private static func mono(size: CGFloat, weight: Font.Weight = .regular) -> Font {
            .custom(monoFamily, size: size).weight(weight)
        }

        // MARK: Type Scale

        /// Large titles (e.g. page headers) -- 28pt bold DM Sans
        static let largeTitle = sans(size: 28, weight: .bold)

        /// Section titles -- 22pt semibold DM Sans
        static let title = sans(size: 22, weight: .semibold)

        /// Sub-section titles -- 18pt semibold DM Sans
        static let title2 = sans(size: 18, weight: .semibold)

        /// Headlines / card titles -- 16pt semibold DM Sans
        static let headline = sans(size: 16, weight: .semibold)

        /// Body text -- 16pt regular DM Sans (matches web --font-dm-sans 400)
        static let body = sans(size: 16, weight: .regular)

        /// Secondary body / callout -- 14pt regular DM Sans
        static let callout = sans(size: 14, weight: .regular)

        /// Small labels, badges -- 12pt regular DM Sans
        static let caption = sans(size: 12, weight: .regular)

        /// Extra small (stat labels, timestamps) -- 10pt regular DM Sans
        static let caption2 = sans(size: 10, weight: .regular)

        /// Monospaced (durations, counts, IDs) -- 14pt Geist Mono
        static let monoText = mono(size: 14)

        /// Semibold callout (chip text, badges) -- 14pt medium DM Sans
        static let calloutMedium = sans(size: 14, weight: .medium)

        /// Card title with tight tracking -- 14pt semibold DM Sans
        static let cardTitle = sans(size: 14, weight: .semibold)
    }
}

// MARK: - Spacing

extension Theme {

    /// Spacing scale (in points). Matches Tailwind's 4px base.
    enum Spacing {
        /// 4pt
        static let xs: CGFloat = 4
        /// 8pt
        static let sm: CGFloat = 8
        /// 12pt
        static let md: CGFloat = 12
        /// 16pt
        static let lg: CGFloat = 16
        /// 24pt
        static let xl: CGFloat = 24
        /// 32pt
        static let xxl: CGFloat = 32
        /// 48pt
        static let xxxl: CGFloat = 48
    }
}

// MARK: - Corner Radius

extension Theme {

    /// Corner radius scale. Web uses --radius: 0.75rem (12px) as the base in dark mode.
    enum CornerRadius {
        /// 6pt -- small badges, chips
        static let sm: CGFloat = 6
        /// 8pt -- buttons, inputs
        static let md: CGFloat = 8
        /// 12pt -- cards, sheets (matches web --radius-lg)
        static let lg: CGFloat = 12
        /// 16pt -- large cards, modals
        static let xl: CGFloat = 16
        /// 999pt -- pills, fully rounded
        static let full: CGFloat = 999
    }
}

// MARK: - View Modifiers

extension Theme {

    /// Applies the standard card style: dark card background, subtle border, rounded corners.
    struct CardModifier: ViewModifier {
        func body(content: Content) -> some View {
            content
                .background(Colors.card)
                .clipShape(RoundedRectangle(cornerRadius: CornerRadius.lg, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: CornerRadius.lg, style: .continuous)
                        .stroke(Colors.border, lineWidth: 1)
                )
        }
    }

    /// Pill-shaped filter chip. Matches SessionTypeChips on web.
    struct ChipModifier: ViewModifier {
        let isSelected: Bool

        func body(content: Content) -> some View {
            content
                .font(Typography.calloutMedium)
                .padding(.horizontal, Spacing.md)
                .padding(.vertical, Spacing.sm)
                .background(isSelected ? Colors.primary : .clear)
                .foregroundStyle(isSelected ? Colors.primaryForeground : Colors.mutedForeground)
                .clipShape(Capsule())
                .overlay(
                    Capsule()
                        .stroke(
                            isSelected ? Colors.primary : Colors.border,
                            lineWidth: 1
                        )
                )
        }
    }

    /// Primary action button -- teal/cyan accent fill.
    struct PrimaryButtonModifier: ViewModifier {
        func body(content: Content) -> some View {
            content
                .font(Typography.calloutMedium)
                .foregroundStyle(Colors.primaryForeground)
                .padding(.horizontal, Spacing.lg)
                .padding(.vertical, Spacing.md)
                .background(Colors.primary)
                .clipShape(RoundedRectangle(cornerRadius: CornerRadius.md, style: .continuous))
        }
    }

    /// Secondary / ghost button -- card-colored background with border.
    struct SecondaryButtonModifier: ViewModifier {
        func body(content: Content) -> some View {
            content
                .font(Typography.calloutMedium)
                .foregroundStyle(Colors.foreground)
                .padding(.horizontal, Spacing.lg)
                .padding(.vertical, Spacing.md)
                .background(Colors.card)
                .clipShape(RoundedRectangle(cornerRadius: CornerRadius.md, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: CornerRadius.md, style: .continuous)
                        .stroke(Colors.border, lineWidth: 1)
                )
        }
    }

    /// Session type badge -- tinted background with matching text color.
    /// Mirrors `SESSION_BADGE_COLORS` on web: `bg-{color}/15 text-{color} border-{color}/20`.
    struct SessionBadgeModifier: ViewModifier {
        let sessionType: String

        func body(content: Content) -> some View {
            let color = Colors.sessionTypeColor(sessionType)
            content
                .font(Typography.caption)
                .foregroundStyle(color)
                .padding(.horizontal, Spacing.sm)
                .padding(.vertical, 2)
                .background(color.opacity(0.15))
                .clipShape(RoundedRectangle(cornerRadius: CornerRadius.sm, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: CornerRadius.sm, style: .continuous)
                        .stroke(color.opacity(0.20), lineWidth: 1)
                )
        }
    }
}

// MARK: - View Modifier Extensions

extension View {

    /// Applies the standard card style.
    func cardStyle() -> some View {
        modifier(Theme.CardModifier())
    }

    /// Applies the filter chip style.
    func chipStyle(isSelected: Bool) -> some View {
        modifier(Theme.ChipModifier(isSelected: isSelected))
    }

    /// Applies the primary button style.
    func primaryButtonStyle() -> some View {
        modifier(Theme.PrimaryButtonModifier())
    }

    /// Applies the secondary button style.
    func secondaryButtonStyle() -> some View {
        modifier(Theme.SecondaryButtonModifier())
    }

    /// Applies the session type badge style.
    func sessionBadgeStyle(for sessionType: String) -> some View {
        modifier(Theme.SessionBadgeModifier(sessionType: sessionType))
    }
}

// MARK: - Haptics

extension Theme {
    enum Haptics {
        static func light() { HapticEngine.tap() }
        static func medium() { HapticEngine.refresh() }
        static func selection() { HapticEngine.select() }
        static func success() { HapticEngine.success() }
        static func error() { HapticEngine.error() }
    }
}

// MARK: - Color Hex Initializer

extension Color {

    /// Creates a `Color` from a hex string (3, 6, or 8 characters, with or without `#`).
    init(hex: String) {
        let cleaned = hex.trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "#", with: "")

        var rgb: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&rgb)

        let red: Double
        let green: Double
        let blue: Double
        let opacity: Double

        switch cleaned.count {
        case 3:
            // RGB shorthand (e.g. "FFF")
            red   = Double((rgb >> 8) & 0xF) / 15
            green = Double((rgb >> 4) & 0xF) / 15
            blue  = Double(rgb & 0xF) / 15
            opacity = 1
        case 6:
            // RRGGBB (e.g. "0a0c11")
            red   = Double((rgb >> 16) & 0xFF) / 255
            green = Double((rgb >> 8) & 0xFF) / 255
            blue  = Double(rgb & 0xFF) / 255
            opacity = 1
        case 8:
            // RRGGBBAA (e.g. "0a0c11FF")
            red   = Double((rgb >> 24) & 0xFF) / 255
            green = Double((rgb >> 16) & 0xFF) / 255
            blue  = Double((rgb >> 8) & 0xFF) / 255
            opacity = Double(rgb & 0xFF) / 255
        default:
            red = 0
            green = 0
            blue = 0
            opacity = 1
        }

        self.init(.sRGB, red: red, green: green, blue: blue, opacity: opacity)
    }
}
