import Link from "next/link";
import { ArrowRight, BellRing, Brain, Send, TrendingUp, Utensils } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AuthCta } from "./_components/AuthCta";

import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

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
    description: "Ask anything about your training. Get answers grounded in your real data.",
  },
  {
    icon: Send,
    title: "Push to Tonal",
    description: "Your coach programs workouts and sends them straight to your machine.",
  },
  {
    icon: BellRing,
    title: "Proactive Check-ins",
    description: "Get nudged when you're overtraining, slacking, or ready to level up.",
  },
  {
    icon: TrendingUp,
    title: "Progress Tracking",
    description: "Strength scores, muscle readiness, and progress photos over time.",
    badge: "Body comp analysis coming soon",
  },
  {
    icon: Utensils,
    title: "Nutrition Intelligence",
    description: "Meal tracking that knows your training load.",
    badge: "Coming Soon",
  },
];

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

      {/* Nav */}
      <nav
        aria-label="Main"
        className="flex items-center justify-between px-4 py-6 sm:px-8 lg:px-12"
      >
        <span className="text-xl font-bold tracking-tight text-foreground">tonal.coach</span>
        <AuthCta variant="nav" />
      </nav>

      <main>
        {/* Hero */}
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
              className="anim-fade-up text-4xl font-bold tracking-tight sm:text-5xl lg:text-7xl"
              style={{
                background: "linear-gradient(135deg, oklch(0.78 0.154 195), oklch(0.6 0.22 300))",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              The personal trainer your Tonal deserves
            </h1>
            <p className="anim-fade-up anim-delay-1 mx-auto mt-8 max-w-lg text-lg leading-relaxed text-muted-foreground sm:text-xl">
              AI coaching powered by your real training data. Get personalized advice, push custom
              workouts, and track your progress.
            </p>
            <div className="anim-fade-up anim-delay-2 mt-10">
              <AuthCta variant="hero" />
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="border-t border-border px-6 py-24 sm:px-8">
          <div className="mx-auto max-w-5xl">
            <p className="anim-fade-up mb-4 text-center text-sm font-medium uppercase tracking-widest text-muted-foreground">
              Everything you need
            </p>
            <h2 className="anim-fade-up anim-delay-1 mx-auto mb-16 max-w-md text-center text-3xl font-bold tracking-tight text-foreground">
              The missing piece for your Tonal
            </h2>

            {/* First row: 2 larger cards */}
            <div className="grid gap-3 sm:grid-cols-2 sm:gap-5">
              {FEATURES.slice(0, 2).map(({ icon: Icon, title, description, badge }) => (
                <FeatureCard
                  key={title}
                  Icon={Icon}
                  title={title}
                  description={description}
                  badge={badge}
                  large
                />
              ))}
            </div>

            {/* Second row: 3 smaller cards */}
            <div className="mt-3 grid gap-3 sm:mt-5 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
              {FEATURES.slice(2).map(({ icon: Icon, title, description, badge }) => (
                <FeatureCard
                  key={title}
                  Icon={Icon}
                  title={title}
                  description={description}
                  badge={badge}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Social proof */}
        <section className="border-t border-border px-6 py-20">
          <div
            className="mx-auto max-w-lg rounded-2xl p-px"
            style={{
              background:
                "linear-gradient(135deg, oklch(0.78 0.154 195 / 40%), oklch(0.6 0.22 300 / 40%))",
            }}
          >
            <blockquote className="rounded-2xl bg-card px-8 py-10 text-center">
              <span
                className="block text-5xl font-bold leading-none"
                style={{ color: "oklch(0.78 0.154 195 / 30%)" }}
                aria-hidden="true"
              >
                &ldquo;
              </span>
              <p className="mt-2 text-xl font-medium text-foreground">
                Built by a Tonal owner, for Tonal owners.
              </p>
              <span
                className="mt-2 block text-5xl font-bold leading-none"
                style={{ color: "oklch(0.78 0.154 195 / 30%)" }}
                aria-hidden="true"
              >
                &rdquo;
              </span>
            </blockquote>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="border-t border-border px-6 py-24 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
            Ready to level up your training?
          </h2>
          <p className="mt-6 text-lg text-muted-foreground">
            Connect your Tonal and start coaching in minutes.
          </p>
          <div className="mt-10">
            <AuthCta variant="bottom" />
          </div>
        </section>
      </main>
      {/* Footer */}
      <footer className="border-t border-border px-6 py-10 text-center">
        <p className="text-sm text-muted-foreground">
          tonal.coach is an independent project. Not affiliated with or endorsed by Tonal.
        </p>
        <div className="mt-3 flex justify-center gap-4 text-xs text-muted-foreground/70">
          <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
            Privacy Policy
          </Link>
          <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">
            Terms of Service
          </Link>
          <a
            href="https://discord.gg/dShrKkwz"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground"
          >
            Discord
          </a>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  Icon,
  title,
  description,
  badge,
  large,
}: {
  Icon: typeof Brain;
  title: string;
  description: string;
  badge?: string;
  large?: boolean;
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl bg-card p-6 ring-1 ring-border transition-all duration-300 hover:ring-foreground/20">
      <div className="relative z-10">
        <div className="mb-4 flex items-center gap-3">
          <div
            className="flex items-center justify-center rounded-xl transition-shadow duration-300"
            style={{
              width: large ? 48 : 40,
              height: large ? 48 : 40,
              background: "oklch(0.78 0.154 195 / 12%)",
              boxShadow: "0 0 20px oklch(0.78 0.154 195 / 8%)",
            }}
          >
            <Icon
              aria-hidden="true"
              className="text-primary"
              style={{ width: large ? 22 : 18, height: large ? 22 : 18 }}
            />
          </div>
          {badge && (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              {badge}
            </Badge>
          )}
        </div>
        <h3 className={`font-semibold text-foreground ${large ? "text-lg" : "text-sm"}`}>
          {title}
        </h3>
        <p
          className={`mt-2 leading-relaxed text-muted-foreground ${large ? "text-base" : "text-sm"}`}
        >
          {description}
        </p>
      </div>
    </div>
  );
}
