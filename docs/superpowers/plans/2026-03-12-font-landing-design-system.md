# Font, Landing Page & Design System Refresh — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Geist with DM Sans, redesign the landing page to sell the full product vision, and standardize the design system with shadcn components and consistent loading/error/empty states.

**Architecture:** Three independent workstreams — (1) global font + accent color via layout.tsx and globals.css, (2) landing page full rewrite as a single page component, (3) install shadcn primitives, create shared state components, and refactor existing pages to use them. All frontend-only, no backend changes.

**Tech Stack:** Next.js 14+ (App Router), Tailwind CSS v4, shadcn/ui (base-nova style with @base-ui/react), DM Sans via next/font/google, Lucide icons

**Spec:** `docs/superpowers/specs/2026-03-12-font-landing-design-system.md`

---

## Chunk 1: Global Typography & Accent Color

### Task 1: Swap Geist to DM Sans

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Update layout.tsx font imports**

Replace the Geist import and variable setup with DM Sans:

```tsx
// In src/app/layout.tsx
// REPLACE these lines:
import { Geist, Geist_Mono } from "next/font/google";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// WITH:
import { DM_Sans, Geist_Mono } from "next/font/google";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});
```

Also update the body className:
```tsx
// REPLACE:
className={`${geistSans.variable} ${geistMono.variable} antialiased`}
// WITH:
className={`${dmSans.variable} ${geistMono.variable} antialiased`}
```

- [ ] **Step 2: Update globals.css font variable**

In `src/app/globals.css`, inside the `@theme inline` block:

```css
/* REPLACE: */
--font-sans: var(--font-sans);
/* WITH: */
--font-sans: var(--font-dm-sans);
```

- [ ] **Step 3: Verify type-check passes**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Visual check — run dev server**

Run: `npm run dev`
Open `http://localhost:3000` — verify DM Sans is rendering on the landing page and all inner pages. Font should look rounder and more geometric than Geist.

- [ ] **Step 5: Commit**

```bash
git add src/app/layout.tsx src/app/globals.css
git commit -m "feat: swap Geist font to DM Sans globally"
```

---

### Task 2: Update accent color

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Update --primary and --primary-foreground in .dark block**

In `src/app/globals.css`, inside the `.dark { ... }` block:

```css
/* REPLACE: */
--primary: oklch(0.922 0 0);
--primary-foreground: oklch(0.205 0 0);
/* WITH: */
--primary: oklch(0.75 0.15 195);
--primary-foreground: oklch(0.985 0 0);
```

- [ ] **Step 2: Visual check**

Run dev server, check:
- Buttons should now be teal/cyan instead of near-white
- Button text should be white and readable
- Focus rings should pick up the new teal color
- Check `/login`, `/chat`, `/settings` pages for consistency

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: update brand accent to vibrant teal"
```

---

## Chunk 2: Install shadcn Components & Create Shared State Components

### Task 3: Install shadcn primitives

**Files:**
- Create: `src/components/ui/card.tsx`
- Create: `src/components/ui/label.tsx`
- Create: `src/components/ui/separator.tsx`
- Create: `src/components/ui/skeleton.tsx`
- Create: `src/components/ui/alert.tsx`

- [ ] **Step 1: Install components via shadcn CLI**

Run each one:
```bash
npx shadcn@latest add card --yes
npx shadcn@latest add label --yes
npx shadcn@latest add separator --yes
npx shadcn@latest add skeleton --yes
npx shadcn@latest add alert --yes
```

- [ ] **Step 2: Verify files were created**

Check that all five files exist in `src/components/ui/`.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/
git commit -m "feat: install shadcn Card, Label, Separator, Skeleton, Alert"
```

---

### Task 4: Create PageLoader component

**Files:**
- Create: `src/components/PageLoader.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/components/PageLoader.tsx
import { Loader2 } from "lucide-react";

interface PageLoaderProps {
  message?: string;
}

export function PageLoader({ message }: PageLoaderProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
        {message && (
          <p className="text-sm text-muted-foreground">{message}</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/PageLoader.tsx
git commit -m "feat: add PageLoader shared component"
```

---

### Task 5: Create ErrorAlert component

**Files:**
- Create: `src/components/ErrorAlert.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/components/ErrorAlert.tsx
"use client";

import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface ErrorAlertProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorAlert({ message, onRetry }: ErrorAlertProps) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="size-4" />
      <AlertDescription className="flex items-center justify-between gap-2">
        <span>{message}</span>
        {onRetry && (
          <Button variant="outline" size="xs" onClick={onRetry}>
            Retry
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}
```

**IMPORTANT — base-nova adaptation required:** After installing `alert.tsx` in Task 3, read it to confirm it exports `Alert`, `AlertDescription`, and supports a `variant="destructive"` prop. The base-nova style uses `@base-ui/react` instead of Radix, so the component API may differ from standard shadcn. If the exports or variant prop names differ, update the imports and props in this component to match the installed file. Do NOT proceed to the commit step until the type-check passes.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/ErrorAlert.tsx
git commit -m "feat: add ErrorAlert shared component"
```

---

### Task 6: Create EmptyState component

**Files:**
- Create: `src/components/EmptyState.tsx`

- [ ] **Step 1: Create the component**

```tsx
// src/components/EmptyState.tsx
"use client";

import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
        <Icon className="size-5 text-muted-foreground" />
      </div>
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      {description && (
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {action && (
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/EmptyState.tsx
git commit -m "feat: add EmptyState shared component"
```

---

## Chunk 3: Landing Page Rewrite

### Task 7: Rewrite landing page

**Files:**
- Modify: `src/app/page.tsx` (full rewrite)

**Reference:** Spec section 3 — five sections: nav, hero (100vh), features (5 cards), social proof, bottom CTA, footer.

- [ ] **Step 1: Rewrite page.tsx**

The landing page is a `"use client"` component because it reads auth state via `useConvexAuth()`.

```tsx
// src/app/page.tsx
"use client";

import Link from "next/link";
import { useConvexAuth } from "convex/react";
import {
  Brain,
  Send,
  BellRing,
  TrendingUp,
  Utensils,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

interface Feature {
  icon: typeof Brain;
  title: string;
  description: string;
  badge?: string;
}

const FEATURES: Feature[] = [
  {
    icon: Brain,
    title: "AI Coaching",
    description:
      "Ask anything about your training. Get answers grounded in your real data.",
  },
  {
    icon: Send,
    title: "Push to Tonal",
    description:
      "Your coach programs workouts and sends them straight to your machine.",
  },
  {
    icon: BellRing,
    title: "Proactive Check-ins",
    description:
      "Get nudged when you're overtraining, slacking, or ready to level up.",
    badge: "Coming Soon",
  },
  {
    icon: TrendingUp,
    title: "Progress Tracking",
    description:
      "Strength scores, muscle readiness, and body composition over time.",
    badge: "Body composition coming soon",
  },
  {
    icon: Utensils,
    title: "Nutrition Intelligence",
    description: "Meal tracking that knows your training load.",
    badge: "Coming Soon",
  },
];

export default function HomePage() {
  const { isAuthenticated, isLoading } = useConvexAuth();

  const ctaHref = isAuthenticated ? "/chat" : "/login";
  const ctaLabel = isAuthenticated ? "Go to Chat" : "Get Started";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4">
        <span className="text-lg font-bold text-foreground">tonal.coach</span>
        <Link
          href={ctaHref}
          className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {isAuthenticated ? "Go to Chat" : "Sign In"}
        </Link>
      </nav>

      {/* Hero */}
      <section className="relative flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
        {/* Glow effect */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-[500px] w-[800px] rounded-full bg-primary/10 blur-3xl" />
        </div>

        <div className="relative z-10">
          <h1 className="mx-auto max-w-2xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            The personal trainer your{" "}
            <span className="text-primary">Tonal</span> deserves
          </h1>
          <p className="mx-auto mt-6 max-w-lg text-base text-muted-foreground sm:text-lg">
            AI coaching powered by your real training data. Get personalized
            advice, push custom workouts, and track your progress — all in one
            place.
          </p>
          <Button
            size="lg"
            className="mt-8"
            render={<Link href={ctaHref} />}
            disabled={isLoading}
          >
            {isLoading ? "Loading..." : ctaLabel}
            <ArrowRight className="ml-1 size-4" data-icon="inline-end" />
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-4 text-center text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Everything you need
          </h2>
          <p className="mx-auto mb-12 max-w-md text-center text-2xl font-bold text-foreground">
            The missing piece for your Tonal
          </p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, description, badge }) => (
              <Card
                key={title}
                className="border-border bg-card/50"
              >
                <CardHeader>
                  <div className="mb-2 flex items-center gap-2">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
                      <Icon className="size-4 text-primary" />
                    </div>
                    {badge && (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        {badge}
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-sm font-semibold">
                    {title}
                  </CardTitle>
                  <CardDescription className="text-sm leading-relaxed">
                    {description}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Social proof */}
      <section className="border-t border-border px-4 py-16">
        <blockquote className="mx-auto max-w-md text-center">
          <p className="text-lg font-medium italic text-foreground">
            &ldquo;Built by a Tonal owner, for Tonal owners.&rdquo;
          </p>
        </blockquote>
      </section>

      {/* Bottom CTA */}
      <section className="border-t border-border px-4 py-20 text-center">
        <h2 className="text-3xl font-bold text-foreground sm:text-4xl">
          Ready to level up your training?
        </h2>
        <p className="mt-4 text-muted-foreground">
          Connect your Tonal and start coaching in minutes.
        </p>
        <Button
          size="lg"
          className="mt-8"
          render={<Link href={ctaHref} />}
          disabled={isLoading}
        >
          {isLoading ? "Loading..." : ctaLabel}
          <ArrowRight className="ml-1 size-4" data-icon="inline-end" />
        </Button>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-4 py-6 text-center">
        <p className="text-xs text-muted-foreground">
          tonal.coach is an independent project. Not affiliated with or endorsed
          by Tonal.
        </p>
      </footer>
    </div>
  );
}
```

Note: The `Card` component import path and props depend on what shadcn generates in Task 3. After installing, check `src/components/ui/card.tsx` for exact export names (likely `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`). The `render` prop on `Button` is a base-nova pattern — it works as shown because the existing Button uses `@base-ui/react/button`. Adjust if Card doesn't export `CardDescription` — might be `CardContent` with a `<p>` inside.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors. Fix any import issues if shadcn Card export names differ.

- [ ] **Step 3: Visual check**

Open `http://localhost:3000` in browser:
- Hero should be full viewport with teal glow behind headline
- "Tonal" word in headline should be teal (text-primary)
- 5 feature cards in a grid
- "Coming Soon" badges on correct features
- Bottom CTA repeats the call-to-action
- Footer with disclaimer

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: redesign landing page with product vision"
```

---

## Chunk 4: Refactor Existing Pages

### Task 8: Refactor login page

**Files:**
- Modify: `src/app/login/page.tsx`

- [ ] **Step 1: Refactor to use shadcn components + PageLoader + ErrorAlert**

Update `src/app/login/page.tsx`:
- Replace the spinner block (lines 26-31) with `<PageLoader />`
- Replace `<label>` elements with shadcn `<Label>`
- Replace error `<p>` with `<ErrorAlert>`
- Wrap the form area in shadcn `<Card>`

Imports to add:
```tsx
import { PageLoader } from "@/components/PageLoader";
import { ErrorAlert } from "@/components/ErrorAlert";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
```

**Keep `Loader2` in the lucide-react import** — it's still used inside the submit button spinner (`<Loader2 className="size-4 animate-spin" />`). Only the full-page loading block is replaced by `PageLoader`.

Replace auth loading block:
```tsx
// REPLACE:
if (authLoading) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}
// WITH:
if (authLoading) {
  return <PageLoader />;
}
```

Replace the form wrapper and labels:
```tsx
// The <div className="w-full max-w-sm"> becomes:
<Card className="w-full max-w-sm">
  <CardHeader className="text-center">
    <CardTitle className="text-2xl">tonal.coach</CardTitle>
    <CardDescription>
      {flow === "signIn" ? "Sign in to your account" : "Create a new account"}
    </CardDescription>
  </CardHeader>
  <CardContent>
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        {/* Input unchanged */}
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        {/* Input unchanged */}
      </div>

      {error && <ErrorAlert message={error} />}

      {/* Button unchanged */}
    </form>

    {/* Sign in/sign up toggle unchanged, moved inside CardContent */}
  </CardContent>
</Card>
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Visual check**

Open `/login` — form should be in a card, labels should look the same, error should show as an Alert.

- [ ] **Step 4: Commit**

```bash
git add src/app/login/page.tsx
git commit -m "refactor: login page uses shadcn Card, Label, ErrorAlert, PageLoader"
```

---

### Task 9: Refactor connect-tonal page

**Files:**
- Modify: `src/app/connect-tonal/page.tsx`

- [ ] **Step 1: Refactor to use shadcn components + PageLoader + ErrorAlert**

Imports to add:
```tsx
import { PageLoader } from "@/components/PageLoader";
import { ErrorAlert } from "@/components/ErrorAlert";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
```

**Keep `Loader2` imported** — it's still used inside the submit button spinner.

Replace the auth loading spinner (lines 22-28) with `<PageLoader />`.

Replace the form wrapper with a `Card`. The `Link2` icon goes in the `CardHeader`:
```tsx
<Card className="w-full max-w-sm">
  <CardHeader className="text-center">
    <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full border border-border bg-muted">
      <Link2 className="size-5 text-muted-foreground" />
    </div>
    <CardTitle className="text-2xl">Connect Your Tonal</CardTitle>
    <CardDescription>
      Link your Tonal account to get personalized coaching based on your
      real training data.
    </CardDescription>
  </CardHeader>
  <CardContent>
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="tonal-email">Tonal Email</Label>
        {/* Input unchanged */}
      </div>
      <div className="space-y-2">
        <Label htmlFor="tonal-password">Tonal Password</Label>
        {/* Input unchanged */}
      </div>

      {error && <ErrorAlert message={error} />}

      {/* Submit button unchanged */}
    </form>

    <p className="mt-6 text-center text-xs text-muted-foreground">
      Your Tonal password is used only to obtain an authentication token. We
      do not store your password.
    </p>
  </CardContent>
</Card>
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Visual check**

Open `/connect-tonal` — should look consistent with login page.

- [ ] **Step 4: Commit**

```bash
git add src/app/connect-tonal/page.tsx
git commit -m "refactor: connect-tonal page uses shadcn Card, Label, ErrorAlert, PageLoader"
```

---

### Task 10: Refactor settings page

**Files:**
- Modify: `src/app/settings/page.tsx`

- [ ] **Step 1: Refactor to use shadcn Card, Separator, PageLoader + add error state**

Updates:
- Replace spinner with `<PageLoader />`
- Replace hand-rolled card divs (`<div className="rounded-lg border border-border bg-card p-4">`) with shadcn `<Card>` + `<CardContent>`
- Add `<Separator>` between sections instead of relying on margin alone
- Add error state: if `isAuthenticated` is true but `me` is `null` (not `undefined` — `undefined` means loading, `null` means query returned null), show an `<ErrorAlert>` instead of spinning forever

Imports to add:
```tsx
import { PageLoader } from "@/components/PageLoader";
import { ErrorAlert } from "@/components/ErrorAlert";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
```

Error state logic:
```tsx
// After the auth loading check, add:
if (isAuthenticated && me === null) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <ErrorAlert message="Failed to load account data. Please try again." />
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Visual check**

Open `/settings` — cards should look the same visually, separators between sections. Verify connected and not-connected states both render.

- [ ] **Step 4: Commit**

```bash
git add src/app/settings/page.tsx
git commit -m "refactor: settings page uses shadcn Card, Separator, PageLoader + error state"
```

---

### Task 11: Refactor dashboard page

**Files:**
- Modify: `src/app/dashboard/page.tsx`

- [ ] **Step 1: Replace CardSkeleton and CardError with shadcn equivalents**

Remove the local `CardSkeleton` and `CardError` components from the top of the file.

Replace `CardSkeleton` usage with shadcn `Card` + `Skeleton`:
```tsx
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// New skeleton replacement:
function DashboardCardSkeleton({ tall }: { tall?: boolean }) {
  return (
    <Card className={tall ? "min-h-[300px]" : "min-h-[200px]"}>
      <CardHeader>
        <Skeleton className="h-4 w-32" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </CardContent>
    </Card>
  );
}
```

Replace `CardError` usage with `ErrorAlert` inside a `Card`:
```tsx
import { ErrorAlert } from "@/components/ErrorAlert";

// New error replacement:
function DashboardCardError({ title, onRetry }: { title: string; onRetry: () => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ErrorAlert message="Failed to load data." onRetry={onRetry} />
      </CardContent>
    </Card>
  );
}
```

Update all references from `CardSkeleton` to `DashboardCardSkeleton` and `CardError` to `DashboardCardError`.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Visual check**

Open `/dashboard` (requires authenticated + Tonal connected). Cards should look the same. Test loading state by throttling network. Test error state by disconnecting.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/page.tsx
git commit -m "refactor: dashboard uses shadcn Card, Skeleton, ErrorAlert"
```

---

### Task 12: Add loading feedback to chat home

**Files:**
- Modify: `src/app/chat/page.tsx`

- [ ] **Step 1: Add a loading spinner overlay when sending a suggestion**

Currently when `sending` is true, the buttons are just disabled. Add a visual spinner near the suggestion that was clicked.

Replace the `sending` state handling — add a `Loader2` spinner below the suggestion grid when sending:

```tsx
// Add to imports:
import { Loader2 } from "lucide-react";

// After the suggestion grid closing </div>, add:
{sending && (
  <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
    <Loader2 className="size-4 animate-spin" />
    <span>Starting conversation...</span>
  </div>
)}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/chat/page.tsx
git commit -m "feat: add loading indicator when sending chat suggestion"
```

---

### Task 13: Add empty state to chat thread

**Files:**
- Modify: `src/components/ChatThread.tsx`

- [ ] **Step 1: Add EmptyState for threads with no messages**

Add an empty state when `results` is empty and not loading:

```tsx
// Add import:
import { EmptyState } from "@/components/EmptyState";
import { MessageSquare } from "lucide-react";

// Inside the render, after the LoadingMore block but before the message list <div>:
// Use status === "Exhausted" to avoid flashing the empty state during initial load.
// The useUIMessages hook returns "LoadingFirstPage" while loading, then "Exhausted"
// when there are no more messages to load.
{status === "Exhausted" && results.length === 0 && (
  <EmptyState
    icon={MessageSquare}
    title="No messages yet"
    description="Send a message to start the conversation."
  />
)}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/ChatThread.tsx
git commit -m "feat: add empty state to chat thread"
```

---

### Task 14: Final verification

- [ ] **Step 1: Full type-check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Visual walkthrough**

Check every page in the browser:
1. `/` — landing page with hero, features, CTA
2. `/login` — card-wrapped form, DM Sans font
3. `/connect-tonal` — card-wrapped form
4. `/chat` — suggestion cards, loading indicator when sending
5. `/chat/{threadId}` — messages, empty state for new thread
6. `/dashboard` — skeleton loading, error states
7. `/settings` — card sections, separators

- [ ] **Step 3: Commit any final fixes**

```bash
git add -A
git commit -m "fix: final adjustments from visual review"
```

Note: Only commit this if there were actual fixes needed. Skip if everything looked good.
