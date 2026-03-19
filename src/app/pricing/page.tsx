import Link from "next/link";
import { Check, Lock, RotateCcw, ShieldCheck } from "lucide-react";
import { SiteNav } from "@/app/_components/SiteNav";
import { SiteFooter } from "@/app/_components/SiteFooter";
import { AuthCta } from "@/app/_components/AuthCta";
import { Badge } from "@/components/ui/badge";

const FEATURES = [
  "AI coaching powered by your training data",
  "Push custom workouts to your Tonal",
  "Automatic progressive overload",
  "Structured periodization",
  "Injury-aware programming",
  "Muscle readiness tracking",
  "RPE-based intensity management",
  "Proactive check-ins and nudges",
  "Progress tracking and strength scores",
] as const;

const TRUST_SIGNALS = [
  { icon: ShieldCheck, label: "No credit card required" },
  { icon: RotateCcw, label: "Cancel anytime" },
  { icon: Lock, label: "Your data, your control" },
] as const;

const productJsonLd = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: "tonal.coach",
  description: "AI-powered custom workout programming for Tonal home gym owners.",
  url: "https://tonal.coach/pricing",
  brand: {
    "@type": "Organization",
    name: "tonal.coach",
  },
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    description: "Free during beta. Small monthly fee after beta to cover AI costs.",
    availability: "https://schema.org/InStock",
  },
};

export default function PricingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <SiteNav />

        <main className="flex-1">
          {/* Page header */}
          <section className="px-6 py-20 text-center sm:py-28">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Pricing</h1>
            <p className="mx-auto mt-4 max-w-lg text-lg text-muted-foreground">
              Simple, transparent pricing
            </p>
          </section>

          {/* Pricing card */}
          <section className="px-6 pb-16">
            <div className="mx-auto max-w-md">
              {/* Gradient border wrapper */}
              <div
                className="rounded-2xl p-[1px]"
                style={{
                  background: "linear-gradient(135deg, oklch(0.78 0.154 195), oklch(0.6 0.22 300))",
                }}
              >
                <div className="rounded-[15px] bg-card px-8 py-10">
                  {/* Badge */}
                  <div className="mb-6 flex justify-center">
                    <Badge
                      className="px-3 py-1 text-sm font-semibold"
                      style={{
                        background:
                          "linear-gradient(135deg, oklch(0.78 0.154 195 / 0.15), oklch(0.6 0.22 300 / 0.15))",
                        color: "oklch(0.78 0.154 195)",
                        border: "1px solid oklch(0.78 0.154 195 / 0.3)",
                      }}
                    >
                      Beta
                    </Badge>
                  </div>

                  {/* Price */}
                  <div className="mb-2 text-center">
                    <span
                      className="text-7xl font-bold tracking-tight"
                      style={{ color: "oklch(0.78 0.154 195)" }}
                    >
                      $0
                    </span>
                    <span className="ml-1 text-xl text-muted-foreground">/month</span>
                  </div>
                  <p className="mb-8 text-center text-muted-foreground">Free while in beta</p>

                  {/* Feature checklist */}
                  <ul className="mb-8 space-y-3">
                    {FEATURES.map((feature) => (
                      <li key={feature} className="flex items-start gap-3">
                        <Check
                          className="mt-0.5 size-4 shrink-0"
                          style={{ color: "oklch(0.78 0.154 195)" }}
                        />
                        <span className="text-sm text-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <div className="flex flex-col items-center gap-3">
                    <AuthCta variant="hero" />
                    <p className="text-xs text-muted-foreground">No credit card required</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Future pricing */}
          <section className="border-t border-border px-6 py-16">
            <div className="mx-auto max-w-lg text-center">
              <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                After beta
              </p>
              <p className="mt-3 text-2xl font-bold tracking-tight">Pricing TBD</p>
              <p className="mt-4 leading-relaxed text-muted-foreground">
                Every workout your coach programs uses AI that costs real money to run. During beta,
                that&apos;s on us. After beta, there will be a small monthly fee to help cover those
                costs &mdash; the goal is to keep it as low as possible. No investors, no ads, no
                data selling. Just a community tool built by a Tonal owner for Tonal owners.
              </p>
              <p className="mt-3 text-sm text-muted-foreground/70">
                Sign up now during beta &mdash; no commitment, no credit card.
              </p>
            </div>
          </section>

          {/* Trust signals */}
          <section className="border-t border-border px-6 py-12">
            <ul className="mx-auto flex max-w-2xl flex-wrap justify-center gap-8">
              {TRUST_SIGNALS.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Icon className="size-4 shrink-0" style={{ color: "oklch(0.78 0.154 195)" }} />
                  {label}
                </li>
              ))}
            </ul>
          </section>

          {/* Cross-links */}
          <section className="border-t border-border px-6 py-12 text-center">
            <div className="flex flex-wrap justify-center gap-6 text-sm">
              <Link
                href="/features"
                className="text-primary underline underline-offset-2 transition-colors hover:text-foreground"
              >
                See all features
              </Link>
              <Link
                href="/faq"
                className="text-primary underline underline-offset-2 transition-colors hover:text-foreground"
              >
                Have questions?
              </Link>
            </div>
          </section>
        </main>

        <SiteFooter />
      </div>
    </>
  );
}
