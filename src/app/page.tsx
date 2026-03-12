"use client";

import Link from "next/link";
import { useConvexAuth } from "convex/react";
import { Dumbbell, Send, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";

const FEATURES = [
  {
    icon: Dumbbell,
    title: "AI Coaching",
    description:
      "Get personalized training advice powered by your actual Tonal data",
  },
  {
    icon: Send,
    title: "Push to Tonal",
    description:
      "Program custom workouts directly to your Tonal machine",
  },
  {
    icon: BarChart3,
    title: "Training Intelligence",
    description:
      "Track strength scores, muscle readiness, and training frequency",
  },
] as const;

export default function HomePage() {
  const { isAuthenticated, isLoading } = useConvexAuth();

  const ctaHref = isAuthenticated ? "/chat" : "/login";
  const ctaLabel = isAuthenticated ? "Go to Chat" : "Get Started";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Hero */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-20 text-center">
        <h1 className="max-w-xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Your AI personal trainer for{" "}
          <span className="text-chart-1">Tonal</span>
        </h1>
        <p className="mt-4 max-w-md text-base text-muted-foreground sm:text-lg">
          Get coaching, analyze your training, and push custom workouts
          — all powered by your real data.
        </p>

        <Button
          size="lg"
          className="mt-8"
          render={<Link href={ctaHref} />}
          disabled={isLoading}
        >
          {isLoading ? "Loading..." : ctaLabel}
        </Button>
      </main>

      {/* Features */}
      <section className="border-t border-border bg-card/50 px-4 py-16">
        <div className="mx-auto grid max-w-4xl gap-8 sm:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <div key={title} className="flex flex-col items-center text-center">
              <div className="mb-4 flex size-12 items-center justify-center rounded-lg border border-border bg-card">
                <Icon className="size-5 text-chart-1" />
              </div>
              <h2 className="text-sm font-semibold text-foreground">
                {title}
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {description}
              </p>
            </div>
          ))}
        </div>
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
