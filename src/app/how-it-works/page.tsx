import type { ReactNode } from "react";
import Link from "next/link";
import { SiteNav } from "@/app/_components/SiteNav";
import { SiteFooter } from "@/app/_components/SiteFooter";
import { AuthCta } from "@/app/_components/AuthCta";
import { MockConnect, MockGoals, MockWorkoutPushed } from "./_mockups";

/* ------------------------------------------------------------------ */
/*  Structured data                                                     */
/* ------------------------------------------------------------------ */

const howToSchema = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "How to Get Custom AI Workouts on Your Tonal",
  description:
    "Connect your Tonal, set your goals, and get AI-programmed workouts pushed directly to your machine.",
  step: [
    {
      "@type": "HowToStep",
      name: "Connect Your Tonal Account",
      text: "Sign up and securely link your Tonal account. We access your workout history, strength scores, and movement data to personalize your programming.",
    },
    {
      "@type": "HowToStep",
      name: "Tell the AI Your Goals",
      text: "Set your training preferences: workout split, days per week, session duration, goals, and any injuries or limitations.",
    },
    {
      "@type": "HowToStep",
      name: "Train with Custom Workouts",
      text: "Your AI coach programs a custom weekly plan and pushes workouts directly to your Tonal machine. Complete them on-screen like any built-in program.",
    },
  ],
};

/* ------------------------------------------------------------------ */
/*  Step data                                                           */
/* ------------------------------------------------------------------ */

interface Step {
  number: number;
  heading: string;
  paragraphs: readonly ReactNode[];
  mockup: ReactNode;
}

const STEPS: Step[] = [
  {
    number: 1,
    heading: "Connect Your Tonal Account",
    paragraphs: [
      "Getting started takes about two minutes. Sign up with your email, then link your Tonal account using your existing credentials. The connection is encrypted end-to-end — your password is never stored in plain text and is only used to authenticate with Tonal's servers.",
      "Once connected, tonal.coach reads your workout history, strength scores, and movement data. This is what allows the AI to build workouts calibrated to you specifically — not a generic template built for an average user.",
      "You stay in control at all times. You can disconnect your Tonal account from your settings at any moment, and we'll never write to your Tonal library without your explicit action.",
    ],
    mockup: <MockConnect />,
  },
  {
    number: 2,
    heading: "Tell the AI Your Goals",
    paragraphs: [
      "After connecting, you set your training preferences in a short onboarding flow. Choose a training split — full body, upper/lower, push/pull/legs, or body part — and how many days per week you want to train. You can also set your target session duration.",
      "Tell the AI about your goals: building strength, adding muscle, improving endurance, or staying consistent. If you have any injuries or physical limitations, flag them here. The coach will work around shoulder impingements, lower back sensitivity, knee issues, or anything else you note.",
      <>
        These preferences aren&apos;t locked in. You can update them any time, and the AI will
        adjust your programming in the next session. See all the ways the coach adapts to you on the{" "}
        <Link
          href="/features"
          className="text-primary underline underline-offset-2 hover:text-primary/80"
        >
          features page
        </Link>
        .
      </>,
    ],
    mockup: <MockGoals />,
  },
  {
    number: 3,
    heading: "Train with Custom Workouts on Your Tonal",
    paragraphs: [
      "When your coach programs a workout, it gets pushed directly to your Tonal machine — no manual entry, no copying from a notes app. Walk up to your Tonal, navigate to your custom workouts, and it's ready to go with exercises, sets, reps, and target weights already configured.",
      "Each workout is built from Tonal's exercise library, so everything your coach selects is something the machine knows how to handle. Digital weight adjustments, Spotter Mode, and all of Tonal's built-in features work exactly as you'd expect.",
      <>
        After each session, your data feeds back into the AI. Completed reps, weights lifted, and
        RPE ratings all sharpen future recommendations. The longer you train with tonal.coach, the
        more accurate your programming becomes. Have questions?{" "}
        <Link
          href="/faq"
          className="text-primary underline underline-offset-2 hover:text-primary/80"
        >
          Check the FAQ
        </Link>
        .
      </>,
    ],
    mockup: <MockWorkoutPushed />,
  },
];

/* ------------------------------------------------------------------ */
/*  Page                                                                */
/* ------------------------------------------------------------------ */

export default function HowItWorksPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteNav />
      <main>
        {/* JSON-LD */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(howToSchema) }}
        />

        {/* Page header */}
        <section className="px-6 py-20 text-center sm:py-28">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            How It Works
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            Three steps to create custom workouts on your Tonal — powered by your real training
            data, not generic templates.
          </p>
        </section>

        {/* Step sections */}
        {STEPS.map((step, i) => {
          const even = i % 2 === 1;
          return (
            <section key={step.number} className="border-t border-border px-6 py-16 sm:py-20">
              <div
                className={`mx-auto grid max-w-5xl items-center gap-10 lg:grid-cols-2 lg:gap-16 ${even ? "lg:[direction:rtl]" : ""}`}
              >
                <div className={even ? "lg:[direction:ltr]" : ""}>
                  <div className="mb-4 flex items-center gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary ring-1 ring-primary/40">
                      {step.number}
                    </span>
                    <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                      Step {step.number}
                    </span>
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                    {step.heading}
                  </h2>
                  {step.paragraphs.map((p, pi) => (
                    <p key={pi} className="mt-4 leading-relaxed text-muted-foreground">
                      {p}
                    </p>
                  ))}
                </div>
                <div className={even ? "lg:[direction:ltr]" : ""}>{step.mockup}</div>
              </div>
            </section>
          );
        })}

        {/* Bottom CTA */}
        <section className="border-t border-border px-6 py-24 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
            Ready to get started?
          </h2>
          <p className="mt-6 text-lg text-muted-foreground">
            Connect your Tonal and have a custom workout on your machine in minutes.
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
