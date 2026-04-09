import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms of service for tonal.coach.",
  alternates: { canonical: "/terms" },
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-bold text-foreground">Terms of Service</h1>
      <p className="mb-8 text-sm text-muted-foreground">Last updated: March 15, 2026</p>

      <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="mb-2 text-base font-semibold text-foreground">Acceptance</h2>
          <p>
            By creating an account or using tonal.coach, you agree to these terms and our{" "}
            <Link href="/privacy" className="text-primary underline underline-offset-2">
              Privacy Policy
            </Link>
            . If you do not agree, do not use the service.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-foreground">What this service is</h2>
          <p>
            tonal.coach is an independent, experimental project that provides AI-powered coaching
            for Tonal fitness machine users. It is not affiliated with, endorsed by, or connected to
            Tonal Systems, Inc. in any way. The service accesses Tonal through unofficial,
            undocumented APIs.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-foreground">
            No warranty and limitation of liability
          </h2>
          <p>
            This service is provided &quot;as is&quot; without warranties of any kind. The developer
            makes no guarantees about uptime, accuracy of AI coaching advice, or continued
            availability of the service.
          </p>
          <p className="mt-2">
            The developer is not liable for any damages arising from use of this service, including
            but not limited to: injury from following AI-generated workout advice, loss of data,
            disruption to your Tonal account, or any other direct or indirect damages.
          </p>
          <p className="mt-2">
            AI coaching is not a substitute for professional medical or fitness advice. Consult a
            qualified professional before starting any exercise program.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-foreground">Tonal account risk</h2>
          <p>
            This service uses unofficial Tonal APIs. Tonal could change or restrict these APIs at
            any time, which may cause the service to stop working. While no account issues have been
            reported, using third-party services with your Tonal account could theoretically result
            in account restrictions. You accept this risk.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-foreground">Your responsibilities</h2>
          <ul className="list-inside list-disc space-y-1">
            <li>You must have an active Tonal membership to use this service</li>
            <li>You are responsible for the security of your tonal.coach account</li>
            <li>
              You should not rely solely on AI advice for training decisions, especially regarding
              pain or injury
            </li>
            <li>You may disconnect your Tonal account at any time</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-foreground">Termination</h2>
          <p>
            The developer may suspend or terminate the service at any time for any reason. You may
            delete your account at any time. All data is permanently deleted upon account closure.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-foreground">Changes</h2>
          <p>
            These terms may be updated. Continued use after changes constitutes acceptance.
            Significant changes will be communicated through the app.
          </p>
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold text-foreground">Contact</h2>
          <p>
            Questions about these terms? Email{" "}
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
