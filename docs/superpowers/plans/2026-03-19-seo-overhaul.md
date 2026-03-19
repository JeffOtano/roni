# SEO Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Achieve comprehensive SEO for search engines, AI agents, and humans — expanded landing page, 4 evergreen pages, structured data, AI discoverability files, and technical SEO foundation.

**Architecture:** All new pages are Server Components (zero client JS except the existing AuthCta island). Content mockups are HTML/CSS using the existing design system. FAQ uses native `<details>`/`<summary>`. Each page gets its own layout with metadata and a dynamic OG image.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind CSS v4, next/og (Satori), schema.org JSON-LD

**Spec:** `docs/superpowers/specs/2026-03-19-seo-overhaul-design.md`

---

## File Structure

### New Files (13)

| File                                       | Responsibility                                            |
| ------------------------------------------ | --------------------------------------------------------- |
| `src/app/features/page.tsx`                | Features page — deep dive on all capabilities             |
| `src/app/features/layout.tsx`              | Features metadata (title, description, canonical, robots) |
| `src/app/features/opengraph-image.tsx`     | Dynamic OG image with "Features" title                    |
| `src/app/how-it-works/page.tsx`            | How It Works page — 3-step flow                           |
| `src/app/how-it-works/layout.tsx`          | How It Works metadata                                     |
| `src/app/how-it-works/opengraph-image.tsx` | Dynamic OG image with "How It Works" title                |
| `src/app/faq/page.tsx`                     | FAQ page — 10-15 questions with accordions                |
| `src/app/faq/layout.tsx`                   | FAQ metadata                                              |
| `src/app/faq/opengraph-image.tsx`          | Dynamic OG image with "FAQ" title                         |
| `src/app/pricing/page.tsx`                 | Pricing page — free beta + $10/mo coming                  |
| `src/app/pricing/layout.tsx`               | Pricing metadata                                          |
| `src/app/pricing/opengraph-image.tsx`      | Dynamic OG image with "Pricing" title                     |
| `public/llms-full.txt`                     | Comprehensive AI agent documentation                      |

### Modified Files (7)

| File                 | Changes                                                                                              |
| -------------------- | ---------------------------------------------------------------------------------------------------- |
| `src/app/page.tsx`   | Full landing page redesign (nav, hero, mockups, how-it-works, features, FAQ, pricing teaser, footer) |
| `src/app/layout.tsx` | Add Organization schema import, remove canonical from root (pages set their own)                     |
| `src/app/JsonLd.tsx` | Expand to 3 schemas: SoftwareApplication (enhanced), Organization, WebSite                           |
| `src/app/sitemap.ts` | Expand from 3 to 7 URLs                                                                              |
| `src/app/robots.ts`  | Add AI bot directives (training, retrieval, search bots)                                             |
| `public/llms.txt`    | Restructure to llms.txt spec format, expand to ~80 lines                                             |
| `next.config.ts`     | Add security headers                                                                                 |

---

## Task 1: Security Headers

**Files:**

- Modify: `next.config.ts`

- [ ] **Step 1: Add security headers to next.config.ts**

Add a `headers` function to the Next.js config that returns security headers for all routes:

```ts
const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};
```

Keep the existing `withSentryConfig` wrapper intact.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add next.config.ts
git commit -m "feat(seo): add security headers to next.config.ts"
```

---

## Task 2: Expand robots.txt with AI Bot Directives

**Files:**

- Modify: `src/app/robots.ts`

- [ ] **Step 1: Update robots.ts to include AI crawler rules**

Replace the single `rules` object with an array of rules. Keep existing disallow list. Add explicit allow rules for major AI bot categories:

```ts
import type { MetadataRoute } from "next";

const APP_ROUTES = [
  "/api",
  "/chat",
  "/check-ins",
  "/connect-tonal",
  "/dashboard",
  "/exercises",
  "/login",
  "/onboarding",
  "/profile",
  "/progress",
  "/reset-password",
  "/settings",
  "/stats",
  "/strength",
  "/workouts",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: APP_ROUTES,
      },
      // AI training crawlers — allow for discoverability
      {
        userAgent: [
          "GPTBot",
          "ClaudeBot",
          "Google-Extended",
          "CCBot",
          "Bytespider",
          "Applebot-Extended",
          "PerplexityBot",
          "cohere-ai",
        ],
        allow: "/",
        disallow: APP_ROUTES,
      },
      // AI retrieval bots — allow (user-triggered fetches)
      {
        userAgent: [
          "ChatGPT-User",
          "Claude-User",
          "Perplexity-User",
          "OAI-SearchBot",
          "Claude-SearchBot",
          "DuckAssistBot",
          "Google-CloudVertexBot",
        ],
        allow: "/",
        disallow: APP_ROUTES,
      },
    ],
    sitemap: "https://tonal.coach/sitemap.xml",
  };
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/robots.ts
git commit -m "feat(seo): add AI bot directives to robots.txt"
```

---

## Task 3: Expand Sitemap

**Files:**

- Modify: `src/app/sitemap.ts`

- [ ] **Step 1: Expand sitemap to 7 URLs**

```ts
import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date().toISOString();
  return [
    {
      url: "https://tonal.coach",
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: "https://tonal.coach/features",
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: "https://tonal.coach/how-it-works",
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: "https://tonal.coach/faq",
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: "https://tonal.coach/pricing",
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: "https://tonal.coach/privacy",
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: "https://tonal.coach/terms",
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/sitemap.ts
git commit -m "feat(seo): expand sitemap to 7 URLs"
```

---

## Task 4: Expand JSON-LD Structured Data

**Files:**

- Modify: `src/app/JsonLd.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Rewrite JsonLd.tsx with multiple schemas**

Replace the single SoftwareApplication schema with a `@graph` containing SoftwareApplication (enhanced), Organization, and WebSite schemas:

```tsx
export function JsonLd() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "SoftwareApplication",
              "@id": "https://tonal.coach/#app",
              name: "tonal.coach",
              applicationCategory: "HealthApplication",
              operatingSystem: "Web",
              description:
                "AI coaching powered by your real Tonal training data. Get personalized advice, push custom workouts pushed directly to your Tonal machine, and track your progress with strength scores and muscle readiness.",
              url: "https://tonal.coach",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD",
                description: "Free during beta. $10/month after beta ends.",
              },
              featureList: [
                "AI coaching powered by real training data",
                "Push custom workouts directly to Tonal",
                "Automatic progressive overload",
                "Structured periodization",
                "Injury-aware programming",
                "Muscle readiness tracking",
                "RPE-based intensity management",
                "Proactive check-ins and nudges",
              ],
            },
            {
              "@type": "Organization",
              "@id": "https://tonal.coach/#org",
              name: "tonal.coach",
              url: "https://tonal.coach",
              logo: "https://tonal.coach/icon.svg",
              sameAs: ["https://discord.gg/dShrKkwz"],
            },
            {
              "@type": "WebSite",
              "@id": "https://tonal.coach/#website",
              name: "tonal.coach",
              url: "https://tonal.coach",
              publisher: { "@id": "https://tonal.coach/#org" },
            },
          ],
        }),
      }}
    />
  );
}
```

- [ ] **Step 2: Remove root canonical from layout.tsx**

In `src/app/layout.tsx`, remove the `alternates: { canonical: "/" }` from the metadata export. Each page will set its own canonical URL.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/app/JsonLd.tsx src/app/layout.tsx
git commit -m "feat(seo): expand JSON-LD to SoftwareApplication + Organization + WebSite graph"
```

---

## Task 5: AI Agent Discoverability Files

**Files:**

- Modify: `public/llms.txt`
- Create: `public/llms-full.txt`

- [ ] **Step 1: Rewrite llms.txt to match the spec format**

Restructure to follow the llmstxt.org specification (Markdown with H1, blockquote, H2 link sections):

```markdown
# tonal.coach

> AI personal trainer for the Tonal home fitness machine. Connects to your Tonal account, analyzes your training history, and programs custom strength workouts using AI coaching. Free during beta, $10/month after.

## Pages

- [Home](https://tonal.coach): Landing page with product overview and signup
- [Features](https://tonal.coach/features): Deep dive on all capabilities — AI coaching, push-to-Tonal, progressive overload, periodization, injury management, muscle readiness, RPE tracking
- [How It Works](https://tonal.coach/how-it-works): 3-step setup flow — connect Tonal, set goals, train with custom workouts
- [FAQ](https://tonal.coach/faq): Common questions about safety, privacy, training, and pricing
- [Pricing](https://tonal.coach/pricing): Free during beta, $10/month after launch
- [Privacy Policy](https://tonal.coach/privacy): How user data is handled, stored, and protected
- [Terms of Service](https://tonal.coach/terms): Usage terms and disclaimers

## Key Facts

- tonal.coach is free to use during beta
- Independent project, not affiliated with or endorsed by Tonal
- Requires a Tonal account and active Tonal membership
- User data accessed only with explicit permission via Tonal account credentials
- Custom workouts are pushed directly to the user's Tonal machine via the Tonal API
- AI coaching is powered by the user's real workout history, strength scores, and movement data

## Features

- Weekly programming: AI-generated training plans tailored to schedule, goals, and recovery
- Progressive overload: Automatic weight progression based on performance trends
- Periodization: Structured training phases (hypertrophy, strength, peaking, deload)
- RPE tracking: Rate of perceived exertion logging for intensity calibration
- Goal setting: Strength targets and body composition goals that shape programming
- Injury management: Avoids contraindicated movements and substitutes alternatives
- Muscle readiness: Visual recovery map showing which muscle groups are ready to train
- Direct Tonal sync: Pushes custom workouts to Tonal — no manual entry
- Proactive check-ins: Nudges when overtraining, slacking, or ready to level up

## Optional

- [Full Documentation](https://tonal.coach/llms-full.txt): Comprehensive product documentation for AI agents
```

- [ ] **Step 2: Create llms-full.txt**

Write comprehensive product documentation (~200-300 lines) in Markdown. Include:

- Product overview and positioning
- Detailed feature descriptions (each feature gets a paragraph)
- How the AI coaching works (data flow: Tonal API → analysis → programming → push back)
- What data is accessed (workout history, strength scores, movement data, user preferences)
- Privacy model (credentials stored encrypted, data accessed with permission, no sharing)
- Pricing (free during beta, $10/month planned)
- Differentiation from Tonal's built-in programs (custom splits, AI-driven progressive overload, injury awareness, periodization)
- Technical overview (Next.js web app, Convex backend, Tonal API integration)
- How to get started (sign up, connect Tonal, set preferences)

Write this as clear, factual prose. No marketing fluff — AI agents filter that out. Write as if briefing a knowledgeable assistant who needs to accurately recommend the product.

- [ ] **Step 3: Commit**

```bash
git add public/llms.txt public/llms-full.txt
git commit -m "feat(seo): expand llms.txt and add llms-full.txt for AI agent discoverability"
```

---

## Task 6: Reusable OG Image Generator

**Files:**

- Read: `src/app/opengraph-image.tsx` (existing pattern)
- Read: `src/app/fonts/DMSans-Bold.ttf` (font file location)

Before creating 4 new OG images, extract a shared helper to avoid duplicating the template. The existing root `opengraph-image.tsx` stays as-is (it has the wordmark + tagline). The new pages use a variant with a page-specific title.

- [ ] **Step 1: Create shared OG image helper**

Create `src/app/_components/createOgImage.tsx`:

```tsx
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const ogSize = { width: 1200, height: 630 };
export const ogContentType = "image/png";

export async function createOgImage(title: string, subtitle?: string) {
  const dmSansBold = await readFile(join(process.cwd(), "src/app/fonts/DMSans-Bold.ttf"));

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#0a0a0a",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: "600px",
          height: "300px",
          borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(0,202,203,0.15) 0%, transparent 70%)",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }}
      />
      <div style={{ display: "flex", fontSize: "48px", fontFamily: "DM Sans", fontWeight: 700 }}>
        <span style={{ color: "#ffffff" }}>tonal</span>
        <span style={{ color: "#00cacb" }}>.</span>
        <span style={{ color: "#ffffff" }}>coach</span>
      </div>
      <span
        style={{
          fontSize: "36px",
          color: "#ffffff",
          marginTop: "24px",
          fontFamily: "DM Sans",
          fontWeight: 700,
          textAlign: "center",
          maxWidth: "800px",
        }}
      >
        {title}
      </span>
      {subtitle && (
        <span
          style={{
            fontSize: "20px",
            color: "#a0a0a0",
            marginTop: "12px",
            fontFamily: "DM Sans",
            fontWeight: 700,
            textAlign: "center",
            maxWidth: "700px",
          }}
        >
          {subtitle}
        </span>
      )}
    </div>,
    {
      ...ogSize,
      fonts: [
        {
          name: "DM Sans",
          data: dmSansBold,
          style: "normal",
          weight: 700,
        },
      ],
    },
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/_components/createOgImage.tsx
git commit -m "feat(seo): add reusable OG image generator"
```

---

## Task 7: Features Page

**Files:**

- Create: `src/app/features/layout.tsx`
- Create: `src/app/features/opengraph-image.tsx`
- Create: `src/app/features/page.tsx`

- [ ] **Step 1: Create features layout.tsx**

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Features — AI-Powered Custom Workouts for Tonal",
  description:
    "AI coaching, push-to-Tonal custom workouts, progressive overload, periodization, injury management, muscle readiness, and RPE tracking. Everything your Tonal is missing.",
  alternates: { canonical: "/features" },
  robots: { index: true, follow: true },
};

export default function FeaturesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

- [ ] **Step 2: Create features opengraph-image.tsx**

```tsx
import { createOgImage, ogSize, ogContentType } from "../_components/createOgImage";

export const alt = "tonal.coach Features — AI-Powered Custom Workouts for Tonal";
export const size = ogSize;
export const contentType = ogContentType;

export default async function OgImage() {
  return createOgImage("Features", "AI-Powered Custom Workouts for Tonal");
}
```

- [ ] **Step 3: Create features page.tsx**

Build a Server Component page with:

- Nav bar matching the new landing page (links to Features, How It Works, Pricing, FAQ + AuthCta)
- Page header: "Features" h1 with keyword-rich subtitle
- 8 feature sections, each with:
  - h2 heading containing target keyword naturally
  - 2-3 paragraphs of descriptive copy
  - Generated HTML/CSS mockup showing the feature (styled with existing design tokens)
  - Alternating left/right text-mockup layout
- Features to cover: AI Coaching, Push to Tonal, Progressive Overload, Periodization, Injury Management, Muscle Readiness, RPE Tracking, Proactive Check-ins
- Bottom CTA with AuthCta
- Footer matching new landing page (3-column: Product / Support / Legal)
- Cross-links to /how-it-works and /pricing in the body copy

Note: The nav and footer are repeated across all public pages. Extract shared components if you see opportunity, but inline is fine too — the landing page (page.tsx) already has them inline. Follow the existing pattern.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Visual verification**

Start dev server (`npm run dev`), visit `http://localhost:3000/features`. Verify:

- Page renders with all feature sections
- Mockups display correctly
- Nav links work
- Footer links work
- No console errors

- [ ] **Step 6: Commit**

```bash
git add src/app/features/
git commit -m "feat(seo): add /features page with deep-dive content and mockups"
```

---

## Task 8: How It Works Page

**Files:**

- Create: `src/app/how-it-works/layout.tsx`
- Create: `src/app/how-it-works/opengraph-image.tsx`
- Create: `src/app/how-it-works/page.tsx`

- [ ] **Step 1: Create how-it-works layout.tsx**

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How It Works — Custom Tonal Workouts in 3 Steps",
  description:
    "Connect your Tonal account, tell the AI your goals, and get custom workouts pushed directly to your machine. Set up in minutes.",
  alternates: { canonical: "/how-it-works" },
  robots: { index: true, follow: true },
};

export default function HowItWorksLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

- [ ] **Step 2: Create how-it-works opengraph-image.tsx**

```tsx
import { createOgImage, ogSize, ogContentType } from "../_components/createOgImage";

export const alt = "How tonal.coach Works — Custom Tonal Workouts in 3 Steps";
export const size = ogSize;
export const contentType = ogContentType;

export default async function OgImage() {
  return createOgImage("How It Works", "Custom Tonal Workouts in 3 Steps");
}
```

- [ ] **Step 3: Create how-it-works page.tsx**

Build a Server Component page with:

- Same nav/footer pattern as features page
- Page header: "How It Works" h1 with keyword-rich subtitle targeting "how to create custom workouts on tonal"
- 3-step expanded flow:
  - Step 1: "Connect Your Tonal Account" — 2-3 paragraphs about security, what data is accessed, how credentials are handled. Generated mockup showing a connection screen.
  - Step 2: "Tell the AI Your Goals" — 2-3 paragraphs about splits, schedule, injuries, preferences, session duration. Generated mockup showing preferences UI.
  - Step 3: "Train with Custom Workouts on Your Tonal" — 2-3 paragraphs about how workouts appear on the machine, the experience. Generated mockup showing a workout being pushed.
- HowTo JSON-LD schema embedded as a `<script type="application/ld+json">` at the top of the page
- Cross-links to /features and /faq
- Bottom CTA

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Visual verification**

Visit `http://localhost:3000/how-it-works`. Verify:

- 3-step flow renders clearly
- Mockups display correctly
- HowTo schema present in page source (view source, search for "HowTo")

- [ ] **Step 6: Commit**

```bash
git add src/app/how-it-works/
git commit -m "feat(seo): add /how-it-works page with 3-step flow and HowTo schema"
```

---

## Task 9: FAQ Page

**Files:**

- Create: `src/app/faq/layout.tsx`
- Create: `src/app/faq/opengraph-image.tsx`
- Create: `src/app/faq/page.tsx`

- [ ] **Step 1: Create faq layout.tsx**

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FAQ — Common Questions About tonal.coach",
  description:
    "Answers about safety, privacy, how the AI works, pricing, and getting started with tonal.coach for your Tonal home gym.",
  alternates: { canonical: "/faq" },
  robots: { index: true, follow: true },
};

export default function FaqLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

- [ ] **Step 2: Create faq opengraph-image.tsx**

```tsx
import { createOgImage, ogSize, ogContentType } from "../_components/createOgImage";

export const alt = "tonal.coach FAQ — Common Questions";
export const size = ogSize;
export const contentType = ogContentType;

export default async function OgImage() {
  return createOgImage("FAQ", "Common Questions About tonal.coach");
}
```

- [ ] **Step 3: Create faq page.tsx**

Build a Server Component page with:

- Same nav/footer pattern
- Page header: "Frequently Asked Questions" h1
- Questions organized by category using h2 headings:
  - **Getting Started** (3 questions)
  - **Safety & Privacy** (4 questions)
  - **Training** (4 questions)
  - **Pricing** (3 questions)
- Each Q&A uses native `<details>`/`<summary>` elements — content is always in the DOM for crawlers, no JS needed
- Answers are 3-5 sentences each
- Answers include contextual cross-links: "Learn more on our [How It Works](/how-it-works) page", "See our [Privacy Policy](/privacy) for details"
- FAQPage JSON-LD schema embedded as a `<script type="application/ld+json">` containing all Q&A pairs
- Suggested questions (adapt to actual product knowledge):
  - "What is tonal.coach?"
  - "How do I get started?"
  - "Do I need a Tonal membership?"
  - "Is it safe to connect my Tonal account?"
  - "What data do you access?"
  - "Will it mess up my Tonal account?"
  - "Can I disconnect at any time?"
  - "How does the AI coaching work?"
  - "How is this different from Tonal's built-in programs?"
  - "Can I customize my workout split?"
  - "Does it handle injuries?"
  - "Is tonal.coach free?"
  - "Will it always be free?"
  - "What happens when it's no longer free?"

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Visual verification**

Visit `http://localhost:3000/faq`. Verify:

- All questions render with working accordions (click to expand/collapse)
- Content is visible in page source even when collapsed
- FAQPage schema present in page source
- Cross-links work

- [ ] **Step 6: Commit**

```bash
git add src/app/faq/
git commit -m "feat(seo): add /faq page with 14 questions and FAQPage schema"
```

---

## Task 10: Pricing Page

**Files:**

- Create: `src/app/pricing/layout.tsx`
- Create: `src/app/pricing/opengraph-image.tsx`
- Create: `src/app/pricing/page.tsx`

- [ ] **Step 1: Create pricing layout.tsx**

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing — Free During Beta | tonal.coach",
  description:
    "tonal.coach is free while in beta. After beta, $10/month for AI-powered custom Tonal workouts, progressive overload, and personalized coaching.",
  alternates: { canonical: "/pricing" },
  robots: { index: true, follow: true },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

- [ ] **Step 2: Create pricing opengraph-image.tsx**

```tsx
import { createOgImage, ogSize, ogContentType } from "../_components/createOgImage";

export const alt = "tonal.coach Pricing — Free During Beta";
export const size = ogSize;
export const contentType = ogContentType;

export default async function OgImage() {
  return createOgImage("Pricing", "Free During Beta");
}
```

- [ ] **Step 3: Create pricing page.tsx**

Build a Server Component page with:

- Same nav/footer pattern
- Page header: "Pricing" h1 with subtitle "Simple, transparent pricing"
- Current plan card (prominent, centered):
  - "Beta" badge
  - "$0 / month" large text
  - "Free while in beta" subtitle
  - Feature checklist: all current features listed with checkmarks
  - "No credit card required"
  - AuthCta "Start Free" button
- Future pricing section:
  - "$10 / month" when beta ends
  - Same feature list
  - "Sign up now to lock in beta access"
- Trust signals section: "No credit card required", "Cancel anytime", "Your data, your control"
- Product JSON-LD schema with Offer embedded as `<script type="application/ld+json">`
- Cross-links to /features and /faq

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Visual verification**

Visit `http://localhost:3000/pricing`. Verify:

- Pricing cards render clearly
- Beta badge is visible
- Feature checklist is readable
- CTA works
- Product schema in page source

- [ ] **Step 6: Commit**

```bash
git add src/app/pricing/
git commit -m "feat(seo): add /pricing page with beta pricing and Product schema"
```

---

## Task 11: Landing Page Redesign

This is the largest task. The entire `src/app/page.tsx` gets rewritten.

**Files:**

- Modify: `src/app/page.tsx`

**Reference:** Read the current `src/app/page.tsx` and the wireframe in the spec (Section 2) before starting.

- [ ] **Step 1: Rewrite page.tsx with all new sections**

Replace the entire page content. The new page has these sections in order:

1. **Nav** — tonal.coach wordmark + links to /features, /how-it-works, /pricing, /faq + AuthCta (nav variant). Use a `<nav>` element with proper `aria-label`.

2. **Hero** — Social proof badge ("Free while in beta"), keyword-rich h1 (must contain "AI", "custom workouts", "Tonal"), descriptive subhead (2 sentences), dual CTA (AuthCta hero + "See How It Works" anchor link as secondary ghost button).

3. **Product Mockup** — Two-panel generated mockup:
   - Left panel: Mock AI coach chat conversation (a user asking for a push day workout, AI responding with a workout plan). Use the dark card style, teal accents.
   - Right panel: Mock strength score display with a number and trend indicator.
   - All content is real HTML text (crawlable).

4. **How It Works** — "How it works" h2, 3 cards: (1) Connect Tonal, (2) Set Your Goals, (3) Train Smarter. Each card: numbered circle, heading, 1-2 sentence description. Use `id="how-it-works"` on the section for the anchor link from the hero CTA.

5. **Feature Deep-Dives** — "Why tonal.coach" h2, then alternating text+mockup cards for each feature. Features: AI Coaching, Push to Tonal, Progressive Overload, Proactive Check-ins, Progress Tracking. Each card: h3 heading, 2-3 sentences of keyword-rich description, small generated mockup on the opposite side. Use alternating layout (text-left/mockup-right, then mockup-left/text-right).

6. **FAQ Preview** — "Common Questions" h2, 3-5 top questions using `<details>`/`<summary>`, answers 3-5 sentences each. Link to full /faq page at the bottom. FAQPage JSON-LD schema for these questions.

7. **Pricing Teaser** — Centered card with gradient border: "Beta Pricing" label, "$0" large, "$10/mo after beta" small, AuthCta. Link to /pricing.

8. **Bottom CTA** — h2 with keywords ("Start training smarter today"), subhead ("Connect your Tonal. Get your first custom workout in minutes."), AuthCta.

9. **Footer** — 3-column layout: Product (Features, How It Works, Pricing) / Support (FAQ, Discord) / Legal (Privacy, Terms). Independent project disclaimer at bottom.

Keep the existing animation styles (ANIM_STYLES) for the hero section. Keep using the existing `AuthCta` component for all CTAs. Keep the animated orb in the hero background.

The `metadata` export stays minimal (just canonical), since the root layout provides the default title/description.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Visual verification**

Visit `http://localhost:3000`. Verify:

- All 9 sections render correctly
- Nav links navigate to correct pages
- "See How It Works" anchor scrolls to the how-it-works section
- Product mockups look realistic and match the design system
- FAQ accordions expand/collapse
- All AuthCta buttons work (show "Get Started" when logged out, "Go to Chat" when logged in)
- Footer links all work
- Page loads quickly (no layout shift, no flash of unstyled content)
- No console errors

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(seo): redesign landing page with product mockups, FAQ, pricing, and full nav"
```

---

## Task 12: Final Integration Verification

- [ ] **Step 1: Type-check entire project**

Run: `npx tsc --noEmit`
Expected: PASS with no errors

- [ ] **Step 2: Run existing tests**

Run: `npm test`
Expected: All existing tests pass (our changes are additive — no existing behavior changed)

- [ ] **Step 3: Verify all pages render**

Start dev server (`npm run dev`), visit each new page:

- `http://localhost:3000` — redesigned landing page
- `http://localhost:3000/features` — features page
- `http://localhost:3000/how-it-works` — how it works page
- `http://localhost:3000/faq` — FAQ page
- `http://localhost:3000/pricing` — pricing page

Verify:

- No 404s or errors
- All pages have consistent nav and footer
- Internal cross-links between pages work
- OG images render (visit `http://localhost:3000/features/opengraph-image` etc.)

- [ ] **Step 4: Verify structured data**

View page source on each page and search for `application/ld+json`:

- Homepage: SoftwareApplication + Organization + WebSite graph
- /how-it-works: HowTo schema
- /faq: FAQPage schema
- /pricing: Product schema
- Homepage FAQ section: FAQPage schema

- [ ] **Step 5: Verify AI agent files**

- `http://localhost:3000/llms.txt` — should serve the expanded llms.txt
- `http://localhost:3000/llms-full.txt` — should serve the comprehensive doc
- Both should be Markdown, well-formatted, factually accurate

- [ ] **Step 6: Verify robots.txt and sitemap**

- `http://localhost:3000/robots.txt` — should show AI bot rules + existing disallow list
- `http://localhost:3000/sitemap.xml` — should list all 7 URLs

- [ ] **Step 7: Commit any fixes**

If any issues found, fix and commit with descriptive message.

- [ ] **Step 8: Final commit if everything is clean**

```bash
git status
# If there are any remaining changes (e.g., formatter fixes):
git add -A && git commit -m "chore: final cleanup after SEO overhaul"
```
