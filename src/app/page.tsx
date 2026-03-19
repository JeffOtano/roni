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
  @media (prefers-reduced-motion: reduce) {
    .anim-fade-up { animation: none; opacity: 1; }
    .orb-animated { animation: none !important; }
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
            {/* Social proof badge */}
            <div className="anim-fade-up mb-6 inline-flex items-center rounded-full border border-border bg-card/80 px-4 py-1.5 text-sm text-muted-foreground backdrop-blur-sm">
              Free while in beta
            </div>

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

        {/* 6. FAQ Preview */}
        <FaqPreview />

        {/* 7. Pricing Teaser */}
        <PricingTeaser />

        {/* 8. Bottom CTA */}
        <section className="border-t border-border px-6 py-24 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
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
