# SEO Overhaul: Perfect SEO for Bots, Agents, and Humans

**Date:** 2026-03-19
**Status:** Approved
**Approach:** Approach 2 — Content + Technical

## Goal

Achieve comprehensive SEO coverage across three audiences:

1. **Search engine bots** (Google, Bing) — rank for Tonal-adjacent queries
2. **AI agents** (ChatGPT, Perplexity, Claude, Gemini) — surface when users ask about Tonal tools
3. **Humans** — convert visitors who land on the site

Priority order: Search rankings > AI agent discoverability > Conversion.

## Target Audience

Tonal owners who feel limited by built-in programs and are searching for custom workout solutions, programming tools, and AI training assistance.

## Primary Keywords

- "tonal custom workouts"
- "tonal ai trainer"
- "tonal workout programming"
- "tonal personal trainer app"

## Secondary Keywords

- "how to create custom workouts on tonal" (how-it-works page)
- "tonal third party apps" (features, faq)
- "tonal progressive overload" (features)
- "tonal workout plan" / "tonal programming app" (homepage, features)
- "is tonal coach free" / "tonal coach cost" (pricing, faq)

---

## 1. Technical SEO Foundation

### Structured Data (JSON-LD) — expand from 1 schema to 5

**SoftwareApplication (existing, enhanced):**

- Add `offers` with pricing transition info (free during beta, $10/mo after)
- Add `screenshot` links when mockup sections are built
- Retain existing fields (name, applicationCategory, operatingSystem, description, url)

**Organization (new):**

- Brand name: tonal.coach
- Logo reference
- Social links: Discord
- `sameAs` for any social profiles

**FAQPage (new):**

- Applied to homepage FAQ section AND /faq page
- Each Q&A pair as a `Question`/`acceptedAnswer` entity
- Triggers expandable Q&A rich snippets in Google search results

**HowTo (new):**

- Applied to /how-it-works page
- 3 steps: Connect Tonal, Set Goals, Train with Custom Workouts
- Can trigger step-by-step rich snippets

**Product (new):**

- Applied to /pricing page
- Name, description, price (free), priceCurrency (USD)
- Captures "tonal coach price" queries with structured price data

### Meta Tags & Headers

**Per-page OG images:**

- Each evergreen page gets its own `opengraph-image.tsx` route
- Same dark/teal template as root, with page-specific title text
- Size: 1200x630px (same as existing)

**Security/performance headers in next.config.ts:**

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: origin-when-cross-origin`
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`

**Canonical URLs:**

- Every public page gets an explicit canonical URL (currently only homepage has one)

### Sitemap Expansion

From 3 URLs to 7:

- `/` — priority 1.0, weekly
- `/features` — priority 0.8, monthly
- `/how-it-works` — priority 0.8, monthly
- `/faq` — priority 0.7, monthly
- `/pricing` — priority 0.7, monthly
- `/privacy` — priority 0.3, monthly
- `/terms` — priority 0.3, monthly

### Internal Linking

- Nav: add links to Features, How It Works, Pricing, FAQ
- Footer: organized into Product / Support / Legal columns
- Each evergreen page cross-links to at least 2 other pages in body copy
- FAQ answers link to relevant pages contextually

---

## 2. Landing Page Redesign

The homepage expands from 4 sections to 10, roughly tripling indexable content. Each section serves dual SEO + conversion purpose.

### Section-by-Section Structure

**Nav (enhanced):**

- Add links to Features, How It Works, Pricing, FAQ
- Keep Sign In CTA
- Provides internal linking signals for crawlers

**Hero (rewritten):**

- Social proof badge above headline: "Free while in beta" + metric (e.g., "X workouts pushed")
- Headline rewritten to include primary keywords naturally (e.g., "AI-powered custom workouts for your Tonal")
- Subhead: 1-2 sentences explaining the value prop with keywords
- Dual CTA: primary "Start Free" + secondary "See How It Works" (anchor link)

**Product mockup section (new):**

- Generated HTML/CSS mockups showing the product in action
- Mock AI coach chat conversation
- Mock strength score dashboard
- All content is crawlable text (not images)
- Keywords embedded naturally in mock content

**How it works (new):**

- 3-step flow: Connect Tonal → Set Your Goals → Train Smarter
- Each step: number, heading, 1-2 sentence description
- Targets "how to" search queries
- HowTo schema applied

**Feature deep-dives (enhanced):**

- Each feature gets a full card with heading, 2-3 sentences of description, and a generated mockup
- Alternating text/mockup layout for visual interest
- Features: AI Coaching, Push to Tonal, Progressive Overload, Proactive Check-ins, Progress Tracking
- More keyword-rich content than the current one-sentence cards

**FAQ section (new on homepage):**

- 3-5 most common questions with accordion UI
- Uses native `<details>`/`<summary>` (no JS, content always in DOM)
- FAQPage schema applied
- Links to full /faq page

**Pricing teaser (new):**

- Simple card: "Free during beta" with key features listed
- "Coming soon: $10/mo" with what's included
- Product schema applied
- Links to full /pricing page

**Bottom CTA (enhanced):**

- Stronger headline with keyword inclusion
- Specific subhead: "Connect your Tonal. Get your first custom workout in minutes."

**Footer (redesigned):**

- 3-column layout: Product (Features, How It Works, Pricing) / Support (FAQ, Discord) / Legal (Privacy, Terms)
- Independent project disclaimer
- Maximizes crawl depth and link equity

### What's Removed

- The current blockquote social proof section ("Built by a Tonal owner, for Tonal owners") — replaced by hero badge with real metrics and the more compelling narrative throughout

### Generated Mockups

Product mockups are built as styled HTML/CSS sections using the existing design system (dark theme, teal #00cacb accents). They are:

- Not actual screenshots (no user data)
- Crawlable text content
- Responsive
- Zero additional network requests (no images to load)

Mockup subjects:

- AI coach chat showing a workout programming conversation
- Strength score dashboard with trend line
- Workout detail view (optional, in feature deep-dives)

---

## 3. Evergreen Pages

### /features

**Target queries:** "tonal custom workouts", "tonal ai trainer", "tonal workout programming app"

**Content:**

- Page title: "Features — AI-Powered Custom Workouts for Tonal"
- Deep dive on each capability with its own section:
  - AI Coaching (knows your history, programs to your goals)
  - Push to Tonal (custom workouts appear on your machine)
  - Progressive Overload (automatic weight progression)
  - Periodization (structured training phases)
  - Injury Management (flags limitations, substitutes movements)
  - Muscle Readiness (visual recovery map)
  - RPE Tracking (calibrate intensity)
  - Proactive Check-ins (overtraining alerts, readiness nudges)
- Each feature: heading, 2-3 paragraphs of keyword-rich copy, generated mockup
- SoftwareApplication schema with feature list
- Cross-links to /how-it-works and /pricing

**Schema:** SoftwareApplication (enhanced with featureList)

### /how-it-works

**Target queries:** "how to create custom workouts on tonal", "how to program tonal", "tonal third party app setup"

**Content:**

- Page title: "How It Works — Custom Tonal Workouts in 3 Steps"
- Expanded 3-step flow:
  - Step 1: Connect Your Tonal Account — security reassurance, what data is accessed, how credentials are handled
  - Step 2: Tell the AI Your Goals — splits, schedule, injuries, preferences, session duration
  - Step 3: Train with Custom Workouts — how push-to-Tonal works, what the experience is like on the machine
- Each step: heading, 2-3 paragraphs, generated mockup of that step
- Cross-links to /features and /faq

**Schema:** HowTo with 3 steps

### /faq

**Target queries:** "is tonal coach safe", "tonal coach app review", "tonal custom workout free"

**Content:**

- Page title: "FAQ — Common Questions About tonal.coach"
- 10-15 questions organized by category:
  - **Getting Started:** "What is tonal.coach?", "How do I get started?", "Do I need a Tonal membership?"
  - **Safety & Privacy:** "Is it safe to connect my Tonal?", "What data do you access?", "Will it mess up my Tonal account?", "Can I disconnect at any time?"
  - **Training:** "How does the AI work?", "How is this different from Tonal's built-in programs?", "Can I customize my workout split?", "Does it handle injuries?"
  - **Pricing:** "Is tonal.coach free?", "Will it always be free?", "What happens when it's no longer free?"
- Accordion UI using native `<details>`/`<summary>` elements
- Answers are 3-5 sentences each (long enough for featured snippet extraction)
- Cross-links to /privacy, /how-it-works, /features within answers

**Schema:** FAQPage with all Q&A pairs

### /pricing

**Target queries:** "tonal coach pricing", "tonal coach cost", "tonal coach free"

**Content:**

- Page title: "Pricing — Free During Beta | tonal.coach"
- Single pricing card: "Free while in beta"
  - Feature checklist of what's included
  - "No credit card required"
- "Coming soon" section: "$10/mo" with what's included at launch
  - "Lock in early — sign up during beta"
- Trust signals: free to try, cancel anytime, no commitments
- Cross-links to /features, /faq

**Schema:** Product with Offer (price: 0, priceCurrency: USD)

### Per-Page Standards

Every evergreen page gets:

- Unique `opengraph-image.tsx` with page-specific title on the standard template
- Canonical URL in metadata
- Title and description targeting the page's primary keyword
- `robots: { index: true, follow: true }` in metadata
- Cross-links to at least 2 other public pages

---

## 4. AI Agent Discoverability

### /llms.txt (expand existing)

Restructure to match the llms.txt spec (llmstxt.org):

- H1: tonal.coach
- Blockquote: concise product summary
- H2 sections with links to key pages: Features, How It Works, FAQ, Pricing, Privacy, Terms
- Each link has a `: description` suffix
- ~80 lines total

### /llms-full.txt (new)

Comprehensive product documentation in Markdown (~200-300 lines):

- Full feature descriptions
- How the AI coaching works (technical overview)
- What data is accessed and how
- Privacy model
- Pricing (free beta, $10/mo planned)
- Differentiation from Tonal's built-in programs
- Target audience
- Technical stack overview (non-sensitive)

### robots.txt Updates

Allow all AI crawlers (both training and retrieval). As a small product seeking maximum discoverability, blocking training bots would be counterproductive.

Add explicit allow directives for major AI bot categories:

- Training: GPTBot, ClaudeBot, Google-Extended, CCBot
- Retrieval: ChatGPT-User, Claude-User, Perplexity-User
- Search: OAI-SearchBot, Claude-SearchBot, DuckAssistBot

Keep existing disallow rules for app routes (/chat, /dashboard, etc.).

Add `Sitemap` directive (already exists).

---

## 5. Copy Strategy

### Principles

- Every section heading contains a target keyword naturally (never stuffed)
- Feature descriptions are 2-3 sentences minimum (gives search engines more to index)
- FAQ answers are 3-5 sentences (long enough for featured snippet extraction)
- Tone: direct, confident, no hype. Speaks to experienced Tonal owners who know their way around the machine
- Alt text on any future images includes keywords naturally
- Copy written during implementation, not specified word-for-word in this spec

### Hero Headline

Must include primary keyword cluster. Current "The personal trainer your Tonal deserves" is poetic but lacks keywords. New headline should hit "AI", "custom workouts", and "Tonal" naturally.

### Keyword Distribution

| Page          | Primary Keywords                            | Secondary Keywords                                 |
| ------------- | ------------------------------------------- | -------------------------------------------------- |
| Homepage      | tonal custom workouts, tonal ai trainer     | tonal workout plan, tonal personal trainer         |
| /features     | tonal workout programming, tonal ai trainer | tonal progressive overload, tonal third party apps |
| /how-it-works | how to create custom workouts on tonal      | tonal programming app, tonal third party app       |
| /faq          | is tonal coach safe, tonal coach review     | tonal custom workout free, tonal coach app         |
| /pricing      | tonal coach pricing, tonal coach cost       | tonal coach free                                   |

---

## 6. Implementation Constraints

### Performance

- All new pages are Server Components (zero client JS)
- Generated mockups are HTML/CSS (no images, no additional network requests)
- FAQ accordion uses native `<details>`/`<summary>` (no JS required, content always in DOM)
- No new npm dependencies for SEO work

### What We're NOT Changing

- Existing app routes (all behind auth, already no-indexed)
- Current auth flow
- Convex backend
- Existing design system / color palette / fonts
- Existing OG image generation approach (we're adding more, not changing the existing one)

### File Impact Estimate

**New files (~12):**

- `src/app/features/page.tsx`
- `src/app/features/layout.tsx`
- `src/app/features/opengraph-image.tsx`
- `src/app/how-it-works/page.tsx`
- `src/app/how-it-works/layout.tsx`
- `src/app/how-it-works/opengraph-image.tsx`
- `src/app/faq/page.tsx`
- `src/app/faq/layout.tsx`
- `src/app/faq/opengraph-image.tsx`
- `src/app/pricing/page.tsx`
- `src/app/pricing/layout.tsx`
- `src/app/pricing/opengraph-image.tsx`

**Modified files (~8):**

- `src/app/page.tsx` (landing page redesign)
- `src/app/layout.tsx` (enhanced root metadata, Organization schema)
- `src/app/JsonLd.tsx` (expanded schemas)
- `src/app/sitemap.ts` (7 URLs)
- `src/app/robots.ts` (AI bot directives)
- `public/llms.txt` (expanded, spec-compliant)
- `public/llms-full.txt` (new comprehensive doc)
- `next.config.ts` (security headers)

**Pricing model:** Free during beta, $10/month fixed cost after beta ends. Pricing page and copy should reflect this transition clearly with urgency to sign up during beta.
