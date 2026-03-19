import type { ReactNode } from "react";
import { SiteNav } from "../_components/SiteNav";
import { SiteFooter } from "../_components/SiteFooter";
import { AuthCta } from "../_components/AuthCta";
import {
  MockChat,
  MockCheckins,
  MockInjuryMap,
  MockPeriodization,
  MockProgressChart,
  MockPushToTonal,
  MockReadiness,
  MockRpe,
} from "./_mockups";

/* ------------------------------------------------------------------ */
/*  Feature data                                                       */
/* ------------------------------------------------------------------ */

interface Feature {
  heading: string;
  paragraphs: readonly string[];
  mockup: ReactNode;
}

const FEATURES: Feature[] = [
  {
    heading: "AI coaching that knows your training history",
    paragraphs: [
      "Ask for a push day and your AI coach builds it from your real Tonal data — not a generic template. It knows your strength scores, recent volume, and which muscles need work.",
      "Every recommendation is grounded in what you've actually done, not what an average lifter might do. The result is programming that feels like it was written by a coach who's watched every rep.",
    ],
    mockup: <MockChat />,
  },
  {
    heading: "Custom workouts, straight to your machine",
    paragraphs: [
      "Your coach programs a workout and pushes it directly to your Tonal — no manual entry, no copying from a notes app. Walk up to your machine and it's ready to go.",
      "Each custom workout includes exercises, sets, reps, and target weights calibrated to your strength. Tonal's digital weight system handles the rest.",
    ],
    mockup: <MockPushToTonal />,
  },
  {
    heading: "Automatic weight progression that actually works",
    paragraphs: [
      "Progressive overload is the foundation of getting stronger, but tracking it manually is tedious. Your AI coach monitors your performance and nudges weights up when you're ready.",
      "The system uses your RPE data and rep performance to determine the right time to increase load — no guessing, no stalling, no ego lifts.",
    ],
    mockup: <MockProgressChart />,
  },
  {
    heading: "Structured training phases for long-term gains",
    paragraphs: [
      "Periodization isn't just for competitive athletes. Your coach organizes training into phases — hypertrophy, strength, peaking, and deload — so you keep making progress without burning out.",
      "Each phase adjusts volume, intensity, and exercise selection automatically. You focus on showing up; the programming handles the rest.",
    ],
    mockup: <MockPeriodization />,
  },
  {
    heading: "Smart programming around your limitations",
    paragraphs: [
      "Flag an injury or limitation and your coach works around it. Shoulder impingement? You'll get chest-supported rows instead of barbell rows, and pressing alternatives that keep you training safely.",
      "Substitutions are drawn from Tonal's exercise library, so every replacement is something you can actually do on the machine.",
    ],
    mockup: <MockInjuryMap />,
  },
  {
    heading: "Know when each muscle group is ready to train",
    paragraphs: [
      "Muscle readiness tracking shows you which groups are recovered and which are still fatigued. Green means go, yellow means proceed with caution, red means rest.",
      "The model factors in volume, intensity, and time since your last session targeting each muscle group — giving you a clear picture before you plan your next workout.",
    ],
    mockup: <MockReadiness />,
  },
  {
    heading: "Rate your effort, refine your programming",
    paragraphs: [
      "RPE tracking lets you tell your coach how hard each set actually felt. Over time, this feedback loop tightens the accuracy of weight recommendations and volume prescriptions.",
      "A set that was prescribed at RPE 8 but felt like a 9? Your coach adjusts future sessions so you stay in the productive training zone.",
    ],
    mockup: <MockRpe />,
  },
  {
    heading: "A coach that pays attention between sessions",
    paragraphs: [
      "Proactive check-ins mean your coach reaches out when something matters — a missed session, a recovery milestone, or a trend that needs attention.",
      "You don't have to remember to ask. The system monitors your training patterns and surfaces insights before you think to look for them.",
    ],
    mockup: <MockCheckins />,
  },
];

/* ------------------------------------------------------------------ */
/*  Page                                                                */
/* ------------------------------------------------------------------ */

export default function FeaturesPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteNav />
      <main>
        {/* Page header */}
        <section className="px-6 py-20 text-center sm:py-28">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Features
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Everything your Tonal is missing — powered by AI and your real training data.
          </p>
        </section>

        {/* Feature sections */}
        {FEATURES.map((feature, i) => {
          const even = i % 2 === 1;
          return (
            <section key={feature.heading} className="border-t border-border px-6 py-16 sm:py-20">
              <div
                className={`mx-auto grid max-w-5xl items-center gap-10 lg:grid-cols-2 lg:gap-16 ${even ? "lg:[direction:rtl]" : ""}`}
              >
                <div className={even ? "lg:[direction:ltr]" : ""}>
                  <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                    {feature.heading}
                  </h2>
                  {feature.paragraphs.map((p) => (
                    <p key={p.slice(0, 40)} className="mt-4 leading-relaxed text-muted-foreground">
                      {p}
                    </p>
                  ))}
                </div>
                <div className={even ? "lg:[direction:ltr]" : ""}>{feature.mockup}</div>
              </div>
            </section>
          );
        })}

        {/* Bottom CTA */}
        <section className="border-t border-border px-6 py-24 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
            Ready to start?
          </h2>
          <p className="mt-6 text-lg text-muted-foreground">
            Connect your Tonal and start coaching in minutes.
          </p>
          <div className="mt-10">
            <AuthCta variant="bottom" />
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
