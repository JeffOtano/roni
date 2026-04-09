import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Privacy policy for tonal.coach. Learn how we handle your data, Tonal credentials, and account information.",
  alternates: { canonical: "/privacy" },
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-bold text-foreground">Privacy Policy</h1>
      <p className="mb-8 text-sm text-muted-foreground">Last updated: March 15, 2026</p>

      <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="mb-2 text-base font-semibold text-foreground">What this service is</h2>
          <p>
            tonal.coach is an independent project built by an individual developer. It is not
            affiliated with, endorsed by, or connected to Tonal in any way. Tonal is a trademark of
            Tonal Systems, Inc. This service uses Tonal&apos;s APIs to read your training data and
            push custom workouts to your machine, but Tonal does not provide a public API or
            officially support third-party integrations.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-foreground">
            Tonal account credentials
          </h2>
          <p>
            When you connect your Tonal account, your email and password are sent to Tonal&apos;s
            authentication system (Auth0) to obtain an access token. Your password is used once for
            this request and is not stored, logged, or retained in any form. The resulting
            authentication token and refresh token are encrypted using AES-256-GCM before being
            stored in our database. These tokens allow the service to read your data and push
            workouts on your behalf.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-foreground">Data we access</h2>
          <p>Through your Tonal token, the service reads:</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>Your Tonal profile (name, training level, workout preferences)</li>
            <li>Strength scores and muscle readiness</li>
            <li>Workout history and activity details</li>
            <li>Exercise catalog (global, not user-specific)</li>
          </ul>
          <p className="mt-2">The service writes:</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>Custom workouts to your Tonal account</li>
          </ul>
          <p className="mt-2">
            We do not access your payment information, personal contacts, or any data unrelated to
            your training.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-foreground">Data we store</h2>
          <ul className="list-inside list-disc space-y-1">
            <li>Your tonal.coach account (email, hashed password)</li>
            <li>Encrypted Tonal auth tokens</li>
            <li>Training preferences and goals you set in the app</li>
            <li>Chat conversations with the AI coach</li>
            <li>Workout feedback ratings (RPE, session ratings)</li>
            <li>Injury records you report</li>
            <li>Cached Tonal data (strength scores, workout history) with automatic expiration</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-foreground">AI and third parties</h2>
          <p>
            Chat conversations are processed by Google&apos;s Gemini AI model to generate coaching
            responses. Your training data is included in the AI context so the coach can give
            personalized advice. Google&apos;s AI usage policies apply to this processing. No data
            is used to train AI models.
          </p>
          <p className="mt-2">
            The service is hosted on Convex (database and backend) and Vercel (frontend). Error
            monitoring is provided by Sentry. No other third parties receive your data.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-foreground">Data deletion</h2>
          <p>
            You can disconnect your Tonal account and delete your tonal.coach account at any time.
            All associated data (conversations, feedback, goals, injuries, and cached data) is
            permanently deleted with no retention period.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-foreground">Risk acknowledgment</h2>
          <p>
            This service accesses Tonal through unofficial APIs that may change or become
            unavailable without notice. Using this service could theoretically affect your Tonal
            account, though no such issues have been reported. By using tonal.coach, you acknowledge
            this risk and agree that the developer is not liable for any impact to your Tonal
            account or subscription.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-foreground">Contact</h2>
          <p>
            For questions, data deletion requests, or concerns, email{" "}
            <a
              href="mailto:jeff.tonalcoach@gmail.com"
              className="text-primary underline underline-offset-2"
            >
              jeff.tonalcoach@gmail.com
            </a>
            .
          </p>
        </section>
      </div>

      <div className="mt-8">
        <Link href="/">
          <Button variant="outline" size="sm">
            Back to Home
          </Button>
        </Link>
      </div>
    </div>
  );
}
