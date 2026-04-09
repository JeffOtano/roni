import Link from "next/link";
import { AuthCta } from "./AuthCta";

/* ------------------------------------------------------------------ */
/*  Data                                                                */
/* ------------------------------------------------------------------ */

interface HowItWorksStep {
  number: number;
  heading: string;
  description: string;
}

const STEPS: HowItWorksStep[] = [
  {
    number: 1,
    heading: "Connect Your Tonal",
    description:
      "Sign up and securely link your Tonal account. Your credentials are encrypted and never stored in plain text.",
  },
  {
    number: 2,
    heading: "Set Your Goals",
    description:
      "Choose your training split, schedule, and goals. Flag any injuries. The AI adapts to you.",
  },
  {
    number: 3,
    heading: "Train Smarter",
    description:
      "Get a custom weekly plan pushed directly to your Tonal. Walk up and it's ready to go.",
  },
];

interface FeatureItem {
  heading: string;
  description: string;
}

const FEATURE_ITEMS: FeatureItem[] = [
  {
    heading: "AI coaching grounded in your training data",
    description:
      "Ask for a push day and the AI builds it from your real Tonal history — strength scores, recent volume, and muscle recovery. Not a generic template.",
  },
  {
    heading: "Custom workouts pushed to your Tonal",
    description:
      "Your coach programs a workout and sends it straight to your machine. No manual entry. Walk up and it's ready with exercises, sets, reps, and weights.",
  },
  {
    heading: "Automatic progressive overload",
    description:
      "The AI monitors your performance and nudges weights up when you're ready. No guessing, no stalling — just steady, data-driven progress.",
  },
  {
    heading: "Proactive check-ins between sessions",
    description:
      "Your coach reaches out when it matters — a missed session, a recovery milestone, or a trend that needs attention. You don't have to remember to ask.",
  },
  {
    heading: "Strength scores and progress tracking",
    description:
      "Track your strength score over time, see which muscle groups are recovered, and monitor weekly volume. All powered by your real Tonal data.",
  },
];

interface FaqItem {
  q: string;
  a: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    q: "Is tonal.coach free?",
    a: "Yes, completely free and open source. No credit card required. You bring your own Google Gemini API key (free from Google AI Studio) so the AI runs on your quota, not ours.",
  },
  {
    q: "Is it safe to connect my Tonal account?",
    a: "Yes. Your credentials are used once to obtain an access token and are never stored. The token is encrypted with AES-256-GCM. We only access workout history, strength scores, and movement data.",
  },
  {
    q: "How does the AI coaching work?",
    a: "The AI analyzes your training history, strength trends, and recovery patterns to build personalized programs. It applies progressive overload, periodization, and injury awareness — grounded in your actual data.",
  },
  {
    q: "How is this different from Tonal's built-in programs?",
    a: "Tonal's programs are pre-built for general audiences. tonal.coach creates fully custom programs based on your data — your lifts, recovery, goals, and injuries. It adapts week to week as your performance changes.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_ITEMS.map(({ q, a }) => ({
    "@type": "Question",
    name: q,
    acceptedAnswer: { "@type": "Answer", text: a },
  })),
};

/* ------------------------------------------------------------------ */
/*  Sections                                                            */
/* ------------------------------------------------------------------ */

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="border-t border-border px-6 py-20 sm:py-24">
      <div className="mx-auto max-w-5xl">
        <p className="mb-4 text-center text-sm font-medium uppercase tracking-widest text-muted-foreground">
          How it works
        </p>
        <h2 className="mx-auto mb-14 max-w-md text-center text-3xl font-bold tracking-tight text-foreground">
          Three steps to smarter training
        </h2>
        <div className="grid gap-6 sm:grid-cols-3">
          {STEPS.map(({ number, heading, description }) => (
            <div
              key={number}
              className={`scroll-fade-up scroll-stagger-${number} rounded-xl bg-card p-6 ring-1 ring-border`}
            >
              <span
                className="mb-4 flex size-10 items-center justify-center rounded-full text-sm font-bold"
                style={{
                  background: "oklch(0.78 0.154 195 / 15%)",
                  color: "oklch(0.78 0.154 195)",
                  boxShadow: "0 0 0 1px oklch(0.78 0.154 195 / 40%)",
                }}
              >
                {number}
              </span>
              <h3 className="mb-2 font-semibold text-foreground">{heading}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FeatureDeepDives() {
  return (
    <section className="border-t border-border px-6 py-20 sm:py-24">
      <div className="mx-auto max-w-5xl">
        <p className="mb-4 text-center text-sm font-medium uppercase tracking-widest text-muted-foreground">
          Why tonal.coach
        </p>
        <h2 className="mx-auto mb-14 max-w-lg text-center text-3xl font-bold tracking-tight text-foreground">
          Custom AI programming for every Tonal owner
        </h2>
        <div className="space-y-6">
          {FEATURE_ITEMS.map(({ heading, description }, i) => (
            <div
              key={heading}
              className={`scroll-fade-up grid items-center gap-8 lg:grid-cols-2 ${i % 2 === 1 ? "lg:[direction:rtl]" : ""}`}
            >
              <div className={i % 2 === 1 ? "lg:[direction:ltr]" : ""}>
                <h3 className="text-xl font-bold tracking-tight text-foreground">{heading}</h3>
                <p className="mt-3 leading-relaxed text-muted-foreground">{description}</p>
              </div>
              <div className={i % 2 === 1 ? "lg:[direction:ltr]" : ""}>
                <FeatureMiniMockup index={i} />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-12 text-center">
          <Link
            href="/features"
            className="text-sm font-medium text-primary underline underline-offset-2 transition-colors hover:text-foreground"
          >
            See all features &rarr;
          </Link>
        </p>
      </div>
    </section>
  );
}

function FeatureMiniMockup({ index }: { index: number }) {
  const mockups = [
    // AI coaching
    <div key="ai" className="rounded-xl bg-card p-4 ring-1 ring-border text-sm">
      <div className="rounded-lg bg-muted px-3 py-2 text-foreground">Give me a pull day</div>
      <div
        className="mt-2 rounded-lg px-3 py-2"
        style={{ background: "oklch(0.78 0.154 195 / 10%)" }}
      >
        <span className="text-xs font-medium" style={{ color: "oklch(0.78 0.154 195)" }}>
          Coach
        </span>
        <p className="mt-1 text-xs text-muted-foreground">
          Back and biceps are recovered. Here&#39;s your session...
        </p>
      </div>
    </div>,
    // Push to Tonal
    <div key="push" className="rounded-xl bg-card p-4 ring-1 ring-border text-sm">
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Custom Workout
      </p>
      <div className="mt-2 flex items-center justify-center rounded-lg bg-primary/15 py-2 text-sm font-medium text-primary">
        Pushed to Tonal
      </div>
    </div>,
    // Progressive overload
    <div key="overload" className="rounded-xl bg-card p-4 ring-1 ring-border">
      <div className="flex items-end gap-1.5" style={{ height: 48 }}>
        {[24, 28, 30, 34, 38, 42].map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-sm"
            style={{
              height: h,
              background: i === 5 ? "oklch(0.78 0.154 195)" : "oklch(0.78 0.154 195 / 30%)",
            }}
          />
        ))}
      </div>
      <p className="mt-2 text-center text-xs text-muted-foreground">+18 lb over 6 weeks</p>
    </div>,
    // Proactive check-ins
    <div key="checkins" className="rounded-xl bg-card p-4 ring-1 ring-border text-sm">
      <div className="rounded-lg bg-muted px-3 py-2">
        <p className="text-[10px] font-medium" style={{ color: "oklch(0.78 0.154 195)" }}>
          Mon 9am
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          You skipped upper body this week. Want a pull session?
        </p>
      </div>
    </div>,
    // Progress tracking
    <div key="progress" className="rounded-xl bg-card p-4 ring-1 ring-border">
      <span className="text-3xl font-bold" style={{ color: "oklch(0.78 0.154 195)" }}>
        847
      </span>
      <span className="ml-2 text-sm text-emerald-400">+12</span>
      <p className="mt-1 text-xs text-muted-foreground">Strength score trending up</p>
    </div>,
  ];
  return mockups[index] ?? null;
}

export function FaqPreview() {
  return (
    <section className="border-t border-border px-6 py-20 sm:py-24">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <div className="mx-auto max-w-3xl">
        <h2 className="scroll-fade-up mb-10 text-center text-3xl font-bold tracking-tight text-foreground">
          Common Questions
        </h2>
        <div className="divide-y divide-border">
          {FAQ_ITEMS.map(({ q, a }) => (
            <details key={q} className="group py-4">
              <summary className="cursor-pointer list-none font-medium text-foreground transition-colors hover:text-primary">
                {q}
              </summary>
              <p className="mt-3 leading-relaxed text-muted-foreground">{a}</p>
            </details>
          ))}
        </div>
        <p className="mt-8 text-center">
          <Link
            href="/faq"
            className="text-sm font-medium text-primary underline underline-offset-2 transition-colors hover:text-foreground"
          >
            See all questions &rarr;
          </Link>
        </p>
      </div>
    </section>
  );
}

export function PricingTeaser() {
  return (
    <section className="border-t border-border px-6 py-20 sm:py-24">
      <div className="mx-auto max-w-md">
        <div
          className="scroll-scale-in rounded-2xl p-[1px]"
          style={{
            background: "linear-gradient(135deg, oklch(0.78 0.154 195), oklch(0.6 0.22 300))",
          }}
        >
          <div className="rounded-[15px] bg-card px-8 py-10 text-center">
            <p
              className="mb-2 text-xs font-medium uppercase tracking-widest"
              style={{ color: "oklch(0.78 0.154 195)" }}
            >
              Open Source
            </p>
            <span
              className="text-6xl font-bold tracking-tight"
              style={{ color: "oklch(0.78 0.154 195)" }}
            >
              $0
            </span>
            <p className="mt-2 text-muted-foreground">Forever free to use</p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground/70">
              Bring your own Google Gemini API key (free from Google AI Studio) so the AI runs on
              your quota, not ours.
            </p>
            <div className="mt-6">
              <AuthCta variant="hero" />
            </div>
          </div>
        </div>
        <p className="mt-6 text-center">
          <Link
            href="/pricing"
            className="text-sm font-medium text-primary underline underline-offset-2 transition-colors hover:text-foreground"
          >
            See pricing details &rarr;
          </Link>
        </p>
      </div>
    </section>
  );
}
