import Link from "next/link";
import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mail } from "lucide-react";

export const metadata: Metadata = {
  title: "Reset Password",
  description: "Reset your tonal.coach account password.",
};

const RESET_STYLES = `
  @keyframes float-orb-reset {
    0%, 100% { transform: scale(1) rotate(0deg); opacity: 0.5; }
    50% { transform: scale(1.1) rotate(180deg); opacity: 0.7; }
  }
  @media (prefers-reduced-motion: reduce) {
    .reset-orb { animation: none !important; }
  }
`;

export default function ResetPasswordPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-6">
      <style dangerouslySetInnerHTML={{ __html: RESET_STYLES }} />

      {/* Animated orb */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div
          className="reset-orb h-[500px] w-[500px] rounded-full blur-[120px] sm:h-[600px] sm:w-[600px]"
          style={{
            background:
              "conic-gradient(from 0deg, oklch(0.78 0.154 195), oklch(0.65 0.19 265), oklch(0.6 0.22 300), oklch(0.78 0.154 195))",
            animation: "float-orb-reset 20s ease-in-out infinite",
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        {/* Wordmark */}
        <h1
          className="mb-10 text-center text-2xl font-bold tracking-tight"
          style={{
            background: "linear-gradient(135deg, oklch(0.78 0.154 195), oklch(0.6 0.22 300))",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          tonal.coach
        </h1>

        {/* Glassmorphic card */}
        <div
          className="rounded-2xl p-px"
          style={{
            background:
              "linear-gradient(135deg, oklch(1 0 0 / 12%), oklch(0.78 0.154 195 / 20%), oklch(1 0 0 / 8%))",
          }}
        >
          <div className="rounded-2xl bg-card/80 px-8 py-8 backdrop-blur-xl">
            <div className="mb-6 flex justify-center">
              <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10">
                <Mail className="size-6 text-primary" />
              </div>
            </div>

            <div className="mb-6 text-center">
              <h2 className="text-xl font-semibold text-foreground">Reset your password</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Password reset via email is not yet available. Please contact support and we will
                help you regain access to your account.
              </p>
            </div>

            <Button
              className="h-11 w-full text-base shadow-lg shadow-primary/25 transition-all duration-300 hover:shadow-xl hover:shadow-primary/40"
              size="lg"
              render={<a href="mailto:support@tonal.coach" />}
            >
              Contact Support
            </Button>

            <div className="mt-6 text-center">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline decoration-primary/40 underline-offset-4 transition-colors duration-300 hover:decoration-primary"
              >
                <ArrowLeft className="size-3.5" />
                Back to sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
