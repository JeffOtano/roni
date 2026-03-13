"use client";

import Link from "next/link";
import { useConvexAuth } from "convex/react";
import { ArrowRight, BellRing, Brain, Send, TrendingUp, Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
    badge: "Coming Soon",
  },
  {
    icon: TrendingUp,
    title: "Progress Tracking",
    description: "Strength scores, muscle readiness, and body composition over time.",
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
            The personal trainer your <span className="text-primary">Tonal</span> deserves
          </h1>
          <p className="mx-auto mt-6 max-w-lg text-base text-muted-foreground sm:text-lg">
            AI coaching powered by your real training data. Get personalized advice, push custom
            workouts, and track your progress — all in one place.
          </p>
          <Button size="lg" className="mt-8" render={<Link href={ctaHref} />} disabled={isLoading}>
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
              <Card key={title} className="border-border bg-card/50">
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
                  <CardTitle className="text-sm font-semibold">{title}</CardTitle>
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
        <Button size="lg" className="mt-8" render={<Link href={ctaHref} />} disabled={isLoading}>
          {isLoading ? "Loading..." : ctaLabel}
          <ArrowRight className="ml-1 size-4" data-icon="inline-end" />
        </Button>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-4 py-6 text-center">
        <p className="text-xs text-muted-foreground">
          tonal.coach is an independent project. Not affiliated with or endorsed by Tonal.
        </p>
      </footer>
    </div>
  );
}
