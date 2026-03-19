import Link from "next/link";
import { SiteNav } from "@/app/_components/SiteNav";
import { SiteFooter } from "@/app/_components/SiteFooter";
import { AuthCta } from "@/app/_components/AuthCta";

type FaqItem = { q: string; a: React.ReactNode; aText: string };
type FaqCategory = { heading: string; items: FaqItem[] };

const FAQ_CATEGORIES: FaqCategory[] = [
  {
    heading: "Getting Started",
    items: [
      {
        q: "What is tonal.coach?",
        aText:
          "tonal.coach is a free (beta) AI personal trainer that connects to your Tonal home gym. It reads your workout history and programs custom workouts that get pushed directly to your machine. Think of it as having a personal trainer who actually knows your training data — your actual lifts, your strength trends, your recovery.",
        a: (
          <>
            tonal.coach is a free (beta) AI personal trainer that connects to your Tonal home gym.
            It reads your workout history and programs custom workouts that get pushed directly to
            your machine. Think of it as having a personal trainer who actually knows your training
            data — your actual lifts, your strength trends, your recovery.
          </>
        ),
      },
      {
        q: "How do I get started?",
        aText:
          "Sign up, connect your Tonal account, set your preferences (goals, schedule, injuries), and start chatting with your AI coach. The setup takes about five minutes. Learn more on the how it works page.",
        a: (
          <>
            Sign up, connect your Tonal account, set your preferences (goals, schedule, injuries),
            and start chatting with your AI coach. The setup takes about five minutes.{" "}
            <Link href="/how-it-works" className="text-primary underline underline-offset-2">
              Learn more on the how it works page
            </Link>
            .
          </>
        ),
      },
      {
        q: "Do I need a Tonal membership?",
        aText:
          "Yes, an active Tonal membership is required. tonal.coach uses the Tonal API to read your training data and push custom workouts to your machine. If your Tonal subscription lapses, the connection will stop working until it is renewed.",
        a: (
          <>
            Yes, an active Tonal membership is required. tonal.coach uses the Tonal API to read your
            training data and push custom workouts to your machine. If your Tonal subscription
            lapses, the connection will stop working until it is renewed.
          </>
        ),
      },
    ],
  },
  {
    heading: "Safety & Privacy",
    items: [
      {
        q: "Is it safe to connect my Tonal account?",
        aText:
          "Yes. Your credentials are used once to obtain an access token and are never stored. The resulting token is encrypted with AES-256-GCM before being saved to our database. We only access the data needed for coaching — workout history, strength scores, and movement data. See our privacy policy for full details.",
        a: (
          <>
            Yes. Your credentials are used once to obtain an access token and are never stored. The
            resulting token is encrypted with AES-256-GCM before being saved to our database. We
            only access the data needed for coaching — workout history, strength scores, and
            movement data.{" "}
            <Link href="/privacy" className="text-primary underline underline-offset-2">
              See our privacy policy
            </Link>{" "}
            for full details.
          </>
        ),
      },
      {
        q: "What data do you access?",
        aText:
          "We access workout history, strength scores, movement performance data, and basic profile info such as your name and training level. We never access payment information, personal contacts, or account settings. Data is only used to generate coaching responses and is not sold or shared with third parties.",
        a: (
          <>
            We access workout history, strength scores, movement performance data, and basic profile
            info such as your name and training level. We never access payment information, personal
            contacts, or account settings. Data is only used to generate coaching responses and is
            not sold or shared with third parties.
          </>
        ),
      },
      {
        q: "Will it mess up my Tonal account?",
        aText:
          "No. tonal.coach only reads your data and adds custom workouts to your Tonal account. It never modifies or deletes existing workouts, programs, or account settings. Custom workouts pushed by the coach appear as a separate category and can be deleted from your Tonal app at any time.",
        a: (
          <>
            No. tonal.coach only reads your data and adds custom workouts to your Tonal account. It
            never modifies or deletes existing workouts, programs, or account settings. Custom
            workouts pushed by the coach appear as a separate category and can be deleted from your
            Tonal app at any time.
          </>
        ),
      },
      {
        q: "Can I disconnect at any time?",
        aText:
          "Yes. You can disconnect your Tonal account from the settings page at any time. When you disconnect, we immediately stop accessing your data. You can also request full account and data deletion, which is permanent with no retention period.",
        a: (
          <>
            Yes. You can disconnect your Tonal account from the settings page at any time. When you
            disconnect, we immediately stop accessing your data. You can also request full account
            and data deletion, which is permanent with no retention period.
          </>
        ),
      },
    ],
  },
  {
    heading: "Training",
    items: [
      {
        q: "How does the AI coaching work?",
        aText:
          "The AI analyzes your training history, strength trends, recovery patterns, and stated goals to build personalized programs. It applies progressive overload, periodization, and injury awareness — the same principles a human coach would use, but grounded in your actual data. See the features page for a full breakdown.",
        a: (
          <>
            The AI analyzes your training history, strength trends, recovery patterns, and stated
            goals to build personalized programs. It applies progressive overload, periodization,
            and injury awareness — the same principles a human coach would use, but grounded in your
            actual data.{" "}
            <Link href="/features" className="text-primary underline underline-offset-2">
              See the features page
            </Link>{" "}
            for a full breakdown.
          </>
        ),
      },
      {
        q: "How is this different from Tonal's built-in programs?",
        aText:
          "Tonal's programs are pre-built for general audiences. tonal.coach creates fully custom programs based on your data — your actual lifts, your recovery, your goals, your injuries. It also supports custom training splits and adapts week to week as your performance changes, rather than following a fixed script.",
        a: (
          <>
            Tonal&apos;s programs are pre-built for general audiences. tonal.coach creates fully
            custom programs based on your data — your actual lifts, your recovery, your goals, your
            injuries. It also supports custom training splits and adapts week to week as your
            performance changes, rather than following a fixed script.
          </>
        ),
      },
      {
        q: "Can I customize my workout split?",
        aText:
          "Yes. Choose from push/pull/legs, upper/lower, full body, or a custom split. Set how many days per week you want to train and your preferred session duration. The coach will build your weekly program around those constraints.",
        a: (
          <>
            Yes. Choose from push/pull/legs, upper/lower, full body, or a custom split. Set how many
            days per week you want to train and your preferred session duration. The coach will
            build your weekly program around those constraints.
          </>
        ),
      },
      {
        q: "Does it handle injuries?",
        aText:
          "Yes. Flag any injuries or physical limitations during onboarding and the AI will avoid contraindicated movements and substitute safe alternatives. You can update your injury list at any time from settings, and the coach will adjust immediately.",
        a: (
          <>
            Yes. Flag any injuries or physical limitations during onboarding and the AI will avoid
            contraindicated movements and substitute safe alternatives. You can update your injury
            list at any time from settings, and the coach will adjust immediately.
          </>
        ),
      },
    ],
  },
  {
    heading: "Pricing",
    items: [
      {
        q: "Is tonal.coach free?",
        aText:
          "Yes, tonal.coach is completely free during the beta period. No credit card is required to sign up. All features are available to all beta users with no limits or hidden tiers.",
        a: (
          <>
            Yes, tonal.coach is completely free during the beta period. No credit card is required
            to sign up. All features are available to all beta users with no limits or hidden tiers.
          </>
        ),
      },
      {
        q: "Will it always be free?",
        aText:
          "Not forever. Every workout your coach programs uses AI that costs real money to run. During beta, that's on us. After beta, there will be a small monthly fee to help cover those costs — the goal is to keep it as affordable as possible. No investors, no ads, no data selling. Just a community tool built by a Tonal owner for Tonal owners.",
        a: (
          <>
            Not forever. Every workout your coach programs uses AI that costs real money to run.
            During beta, that&apos;s on us. After beta, there will be a small monthly fee to help
            cover those costs &mdash; the goal is to keep it as affordable as possible. No
            investors, no ads, no data selling. Just a community tool built by a Tonal owner for
            Tonal owners.{" "}
            <Link href="/pricing" className="text-primary underline underline-offset-2">
              The pricing page has more details
            </Link>
            .
          </>
        ),
      },
      {
        q: "What happens when it's no longer free?",
        aText:
          "Beta users will be notified well in advance before any pricing changes take effect. You will never be charged without explicit opt-in. You can always export or permanently delete your data, regardless of subscription status.",
        a: (
          <>
            Beta users will be notified well in advance before any pricing changes take effect. You
            will never be charged without explicit opt-in. You can always export or permanently
            delete your data, regardless of subscription status.
          </>
        ),
      },
    ],
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_CATEGORIES.flatMap(({ items }) =>
    items.map(({ q, aText }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: {
        "@type": "Answer",
        text: aText,
      },
    })),
  ),
};

export default function FaqPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <div className="min-h-screen bg-background text-foreground">
        <SiteNav />

        <main className="mx-auto max-w-3xl px-4 py-16 sm:px-8">
          <header className="mb-16 text-center">
            <h1 className="mb-3 text-4xl font-bold tracking-tight sm:text-5xl">
              Frequently Asked Questions
            </h1>
            <p className="text-lg text-muted-foreground">
              Everything you need to know about tonal.coach
            </p>
          </header>

          <div className="space-y-12">
            {FAQ_CATEGORIES.map(({ heading, items }) => (
              <section key={heading}>
                <h2 className="mb-4 border-t border-border pt-8 text-xl font-semibold text-foreground">
                  {heading}
                </h2>
                <div className="divide-y divide-border">
                  {items.map(({ q, a }) => (
                    <details key={q} className="group py-4">
                      <summary className="cursor-pointer list-none font-medium text-foreground transition-colors hover:text-primary">
                        {q}
                      </summary>
                      <p className="mt-3 leading-relaxed text-muted-foreground">{a}</p>
                    </details>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <section className="mt-20 text-center">
            <h2 className="mb-2 text-2xl font-bold">Still have questions?</h2>
            <p className="mb-6 text-muted-foreground">
              Join the community on{" "}
              <a
                href="https://discord.gg/dShrKkwz"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2"
              >
                Discord
              </a>{" "}
              or get started and ask the coach directly.
            </p>
            <AuthCta variant="bottom" />
          </section>
        </main>

        <SiteFooter />
      </div>
    </>
  );
}
