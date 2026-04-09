import Link from "next/link";
import { SiteNav } from "./_components/SiteNav";
import { SiteFooter } from "./_components/SiteFooter";
import { AuthCta } from "./_components/AuthCta";
import { ProductMockup } from "./_components/ProductMockup";
import {
  FaqPreview,
  FeatureDeepDives,
  HowItWorksSection,
  PricingTeaser,
} from "./_components/HomeSections";
import { Testimonials } from "./_components/Testimonials";

import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const ANIM_STYLES = `
  @keyframes float-orb {
    0%, 100% { transform: scale(1) rotate(0deg); opacity: 0.6; }
    33% { transform: scale(1.08) rotate(120deg); opacity: 0.8; }
    66% { transform: scale(0.95) rotate(240deg); opacity: 0.65; }
  }
  @keyframes fade-up {
    from { opacity: 0; transform: translateY(24px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  .anim-fade-up {
    animation: fade-up 0.8s ease-out both;
  }
  .anim-delay-1 { animation-delay: 0.1s; }
  .anim-delay-2 { animation-delay: 0.2s; }
  .anim-delay-3 { animation-delay: 0.3s; }
  .anim-delay-4 { animation-delay: 0.4s; }
  .anim-delay-5 { animation-delay: 0.5s; }
  /* Scroll-driven entrance animations (CSS-only, no JS) */
  @keyframes scroll-fade-up {
    from { opacity: 0; transform: translateY(40px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes scroll-scale-in {
    from { opacity: 0; transform: scale(0.92); }
    to { opacity: 1; transform: scale(1); }
  }
  @keyframes scroll-slide-left {
    from { opacity: 0; transform: translateX(40px); }
    to { opacity: 1; transform: translateX(0); }
  }
  @keyframes scroll-slide-right {
    from { opacity: 0; transform: translateX(-40px); }
    to { opacity: 1; transform: translateX(0); }
  }

  @supports (animation-timeline: view()) {
    .scroll-fade-up {
      animation: scroll-fade-up ease-out both;
      animation-timeline: view();
      animation-range: entry 0% entry 35%;
    }
    .scroll-scale-in {
      animation: scroll-scale-in ease-out both;
      animation-timeline: view();
      animation-range: entry 0% entry 35%;
    }
    .scroll-slide-left {
      animation: scroll-slide-left ease-out both;
      animation-timeline: view();
      animation-range: entry 0% entry 35%;
    }
    .scroll-slide-right {
      animation: scroll-slide-right ease-out both;
      animation-timeline: view();
      animation-range: entry 0% entry 35%;
    }
    .scroll-stagger-1 { animation-range: entry 5% entry 40%; }
    .scroll-stagger-2 { animation-range: entry 10% entry 45%; }
    .scroll-stagger-3 { animation-range: entry 15% entry 50%; }
  }

  @media (prefers-reduced-motion: reduce) {
    .anim-fade-up { animation: none; opacity: 1; }
    .orb-animated { animation: none !important; }
    .scroll-fade-up, .scroll-scale-in,
    .scroll-slide-left, .scroll-slide-right { animation: none !important; opacity: 1; transform: none; }
  }
`;

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <style dangerouslySetInnerHTML={{ __html: ANIM_STYLES }} />

      {/* 1. Nav */}
      <SiteNav />

      <main>
        {/* 2. Hero */}
        <section className="relative flex flex-1 flex-col items-center justify-center px-6 py-32 text-center sm:py-40">
          {/* Animated orb */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
            <div
              className="orb-animated h-[500px] w-[500px] rounded-full blur-[120px] sm:h-[700px] sm:w-[700px]"
              style={{
                background:
                  "conic-gradient(from 0deg, oklch(0.78 0.154 195), oklch(0.65 0.19 265), oklch(0.6 0.22 300), oklch(0.78 0.154 195))",
                animation: "float-orb 20s ease-in-out infinite",
              }}
            />
          </div>

          <div className="relative z-10 mx-auto max-w-3xl">
            <h1
              className="anim-fade-up anim-delay-1 text-4xl font-bold tracking-tight sm:text-5xl lg:text-7xl"
              style={{
                background: "linear-gradient(135deg, oklch(0.78 0.154 195), oklch(0.6 0.22 300))",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              AI-powered custom workouts for your Tonal
            </h1>

            <p className="anim-fade-up anim-delay-2 mx-auto mt-8 max-w-lg text-lg leading-relaxed text-muted-foreground sm:text-xl">
              Connect your Tonal account. Tell the AI your goals. Get a personalized program pushed
              directly to your machine every week.
            </p>

            <div className="anim-fade-up anim-delay-3 mt-10 flex flex-wrap items-center justify-center gap-4">
              <AuthCta variant="hero" />
              <Link
                href="#how-it-works"
                className="inline-flex h-12 items-center rounded-lg border border-border px-6 text-base font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
              >
                See How It Works
              </Link>
            </div>
          </div>
        </section>

        {/* 3. Product Mockup */}
        <ProductMockup />

        {/* 4. How It Works */}
        <HowItWorksSection />

        {/* 5. Feature Deep-Dives */}
        <FeatureDeepDives />

        {/* 6. Testimonials */}
        <Testimonials />

        {/* 7. FAQ Preview */}
        <FaqPreview />

        {/* 8. Browse Workouts */}
        <section className="border-t border-border px-6 py-24">
          <div className="mx-auto max-w-4xl text-center">
            <p className="scroll-fade-up mb-3 text-sm font-medium uppercase tracking-wider text-primary">
              Workout Library
            </p>
            <h2 className="scroll-fade-up text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              See what Coach builds
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
              800+ AI-designed workouts covering every split, goal, and experience level. Each one
              built with real exercise science and ready to open directly on your Tonal.
            </p>

            <div className="mt-10 grid gap-4 text-left sm:grid-cols-3">
              <Link
                href="/workouts?goal=build_muscle"
                className="scroll-fade-up group rounded-xl border border-border bg-card p-6 transition-colors hover:border-foreground/20"
              >
                <p className="text-2xl font-bold text-foreground">Hypertrophy</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Chest, back, legs, arms - high-volume workouts designed to maximize growth.
                </p>
                <p className="mt-3 text-xs font-medium text-primary transition-colors group-hover:text-foreground">
                  Browse workouts &rarr;
                </p>
              </Link>
              <Link
                href="/workouts?goal=strength"
                className="scroll-fade-up scroll-stagger-1 group rounded-xl border border-border bg-card p-6 transition-colors hover:border-foreground/20"
              >
                <p className="text-2xl font-bold text-foreground">Strength</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Heavy compounds, low reps. Programs built for raw strength gains.
                </p>
                <p className="mt-3 text-xs font-medium text-primary transition-colors group-hover:text-foreground">
                  Browse workouts &rarr;
                </p>
              </Link>
              <Link
                href="/workouts?goal=functional"
                className="scroll-fade-up scroll-stagger-2 group rounded-xl border border-border bg-card p-6 transition-colors hover:border-foreground/20"
              >
                <p className="text-2xl font-bold text-foreground">Functional</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Real-world movement patterns for daily strength and injury prevention.
                </p>
                <p className="mt-3 text-xs font-medium text-primary transition-colors group-hover:text-foreground">
                  Browse workouts &rarr;
                </p>
              </Link>
            </div>

            <div className="mt-8">
              <Link
                href="/workouts"
                className="inline-flex h-12 items-center rounded-lg bg-foreground px-8 text-base font-medium text-background transition-opacity hover:opacity-90"
              >
                Browse All Workouts
              </Link>
            </div>
          </div>
        </section>

        {/* 9. Pricing Teaser */}
        <PricingTeaser />

        {/* 10. Bottom CTA */}
        <section className="border-t border-border px-6 py-24 text-center">
          <h2 className="scroll-fade-up text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
            Start training smarter today
          </h2>
          <p className="mt-6 text-lg text-muted-foreground">
            Connect your Tonal. Get your first custom workout in minutes.
          </p>
          <div className="mt-10">
            <AuthCta variant="bottom" />
          </div>
        </section>
      </main>

      {/* 9. Footer */}
      <SiteFooter />
    </div>
  );
}
