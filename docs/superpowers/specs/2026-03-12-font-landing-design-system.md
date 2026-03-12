# Font, Landing Page & Design System Refresh

## Goal

Replace the default Geist font with DM Sans, redesign the landing page to sell tonal.coach's full product vision, and tighten the design system with shared shadcn components and consistent loading/error/empty states across all pages.

## Context

tonal.coach is an AI coaching app for Tonal fitness machine owners. The current landing page is a minimal hero + 3-feature grid that undersells the product. The font (Geist) feels generic. Loading and error states are inconsistent across pages — some have skeletons, some have spinners, some have nothing.

The product vision is bigger than the current feature set: proactive coaching, progress photos, nutrition tracking. The landing page needs to sell that vision with "coming soon" badges on unreleased features.

## Architecture

Three workstreams, all frontend-only:

1. **Global typography + accent color** — layout.tsx + globals.css changes, inherited by all pages
2. **Landing page rewrite** — single file (`src/app/page.tsx`), self-contained
3. **Design system + state handling** — install shadcn components, create shared state components, refactor existing pages

No backend changes. No new dependencies beyond what `next/font/google` and shadcn provide.

---

## 1. Typography

**Primary font:** DM Sans via `next/font/google`. Replaces Geist as `--font-sans`.

**Mono font:** Keep Geist Mono for code contexts (tool call indicators, inline code in chat).

**Weight usage:**
- 700 (bold): page headings, hero headline
- 500 (medium): subheadings, form labels, button text
- 400 (regular): body text, descriptions

**Files changed:**
- `src/app/layout.tsx` — swap `Geist` import for `DM_Sans`, set variable to `--font-dm-sans`, update body className
- `src/app/globals.css` — update `--font-sans: var(--font-dm-sans)` in `@theme inline` block

All pages inherit automatically. No per-page font changes needed.

---

## 2. Accent Color

**Current:** `chart-1` is `oklch(0.809 0.105 251.813)` (muted blue). Used as the only accent across the app.

**New brand accent:** Vibrant teal/cyan in the `oklch(0.75 0.15 195)` range. Energetic, fitness-appropriate, pops on dark backgrounds.

**Applied to:**
- `--primary` CSS variable (dark theme) — buttons, focus rings, links
- Hero headline accent word
- Hero glow gradient
- Feature section icons on landing page
- "Coming soon" badge borders (muted version)

**Not changed:**
- Chart colors (`chart-1` through `chart-5`) stay as-is for data visualization
- Neutrals (background, card, border, muted) stay as-is

**Also update `--primary-foreground`:** The current dark-mode `--primary-foreground` is near-black (`oklch(0.205 0 0)`), designed to contrast against the old near-white primary. With a teal primary, foreground must be white/near-white (`oklch(0.985 0 0)`) for accessible contrast on buttons and other primary-bg elements.

**Light mode:** The app hardcodes `className="dark"` on `<html>`. Light mode is out of scope. No `:root` primary changes needed.

**Files changed:**
- `src/app/globals.css` — update `--primary` and `--primary-foreground` in `.dark` block

---

## 3. Landing Page

Full rewrite of `src/app/page.tsx`. Five sections:

### 3.1 Nav bar
- Logo ("tonal.coach") top-left
- "Sign In" link top-right (or "Go to Chat" if authenticated)
- Transparent, minimal

### 3.2 Hero (full viewport)
- Headline: punchy, sells "the missing piece for your Tonal" angle
- Subtitle: 1-2 sentences positioning it as a coaching layer
- Single CTA button (accent-colored, prominent)
- Radial gradient glow behind headline (accent color at ~10-15% opacity)

### 3.3 Feature sections
Five features in a staggered or asymmetric grid layout:
- **AI Coaching** — "Ask anything about your training. Get answers grounded in your real data."
- **Push to Tonal** — "Your coach programs workouts and sends them straight to your machine."
- **Proactive Check-ins** — "Get nudged when you're overtraining, slacking, or ready to level up." *(coming soon badge)*
- **Progress Tracking** — "Strength scores, muscle readiness, and body composition over time." *(coming soon badge for body comp)*
- **Nutrition Intelligence** — "Meal tracking that knows your training load." *(coming soon badge)*

Each feature: Lucide icon + headline + 1-2 line description. Uses shadcn Card.

Icons: Brain (coaching), Send (push), BellRing (proactive), TrendingUp (progress), Utensils (nutrition).

### 3.4 Social proof placeholder
Quote-style block: "Built by a Tonal owner, for Tonal owners." Keeps it authentic, no fake testimonials.

### 3.5 Bottom CTA
Repeat headline + CTA button. Standard conversion doubling pattern.

### 3.6 Footer
- "Not affiliated with or endorsed by Tonal." disclaimer
- Minimal, no link soup

**"Coming soon" badges:** Small pill using shadcn Badge (already installed at `src/components/ui/badge.tsx`) with `variant="outline"`, muted styling. Applied to features not yet built.

---

## 4. Design System Components

### 4.1 Install shadcn components
- `Card` (CardHeader, CardTitle, CardDescription, CardContent)
- `Label`
- `Separator`
- `Skeleton`
- `Alert` (AlertTitle, AlertDescription)

### 4.2 New shared components

**`src/components/PageLoader.tsx`**
- Centered full-screen spinner with optional message text
- Replaces 4 copy-pasted spinner patterns in login, connect-tonal, settings, chat
- Props: `message?: string`

**`src/components/ErrorAlert.tsx`**
- Uses shadcn Alert with destructive variant
- Props: `message: string`, `onRetry?: () => void`
- Replaces inconsistent inline error `<p>` tags

**`src/components/EmptyState.tsx`**
- Centered icon + message + optional CTA button
- Props: `icon: LucideIcon`, `title: string`, `description?: string`, `action?: { label: string, onClick: () => void }`
- For empty thread lists, empty chat, etc.

### 4.3 Refactor existing pages

**Login (`src/app/login/page.tsx`):**
- Replace spinner with `PageLoader`
- Replace `<label>` with shadcn `Label`
- Replace error `<p>` with `ErrorAlert`
- Wrap form in shadcn `Card`

**Connect Tonal (`src/app/connect-tonal/page.tsx`):**
- Same treatment as Login: `PageLoader`, `Label`, `ErrorAlert`, `Card`

**Settings (`src/app/settings/page.tsx`):**
- Replace spinner with `PageLoader`
- Replace hand-rolled card divs with shadcn `Card`
- Add error state if `getMe` query returns `null` unexpectedly (instead of infinite spinner)
- Use `Separator` between sections

**Dashboard (`src/app/dashboard/page.tsx`):**
- Replace custom `CardSkeleton` with shadcn `Skeleton` inside shadcn `Card`
- Replace custom `CardError` with `ErrorAlert` inside shadcn `Card`
- Keep the per-card loading/error pattern (it's good)

**Chat home (`src/app/chat/page.tsx`):**
- Add a subtle loading overlay or spinner when a suggestion is being sent (currently just disables buttons)

**Chat thread (`src/components/ChatThread.tsx`):**
- Add `EmptyState` for threads with no messages yet
- Existing "Load more" and streaming states are fine

**Chat layout (`src/app/chat/layout.tsx`):**
- No changes needed

---

## 5. Files Summary

### Created
- `src/components/PageLoader.tsx`
- `src/components/ErrorAlert.tsx`
- `src/components/EmptyState.tsx`
- shadcn component files (Card, Label, Separator, Skeleton, Alert) via `npx shadcn@latest add`

### Modified
- `src/app/layout.tsx` — font swap
- `src/app/globals.css` — accent color
- `src/app/page.tsx` — full rewrite
- `src/app/login/page.tsx` — shadcn components + state handling
- `src/app/connect-tonal/page.tsx` — shadcn components + state handling
- `src/app/settings/page.tsx` — shadcn components + state handling + error state
- `src/app/dashboard/page.tsx` — swap to shadcn Skeleton/Card
- `src/app/chat/page.tsx` — loading feedback
- `src/components/ChatThread.tsx` — empty state

### Not touched
- All Convex backend files
- Chat message rendering, tool indicators, workout cards
- Thread sidebar
- Status banner

---

## 6. Success Criteria

- DM Sans renders across all pages
- Landing page sells the full product vision with current + future features
- Every page has proper loading, error, and empty states
- No raw `<label>`, `<p className="text-destructive">`, or hand-rolled card patterns remain in pages listed in section 4.3
- Type-checks pass (`npx tsc --noEmit`)
- No visual regressions on existing pages (chat, dashboard, settings)
