"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageLoader } from "@/components/PageLoader";
import { ErrorAlert } from "@/components/ErrorAlert";
import { useAnalytics } from "@/lib/analytics";
import { Loader2 } from "lucide-react";

type Flow = "signIn" | "signUp";

const LOGIN_STYLES = `
  @keyframes float-orb-login {
    0%, 100% { transform: scale(1) rotate(0deg); opacity: 0.5; }
    50% { transform: scale(1.1) rotate(180deg); opacity: 0.7; }
  }
  @media (prefers-reduced-motion: reduce) {
    .login-orb { animation: none !important; }
  }
`;

export default function LoginPage() {
  const { signIn } = useAuthActions();
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const router = useRouter();
  const { track } = useAnalytics();

  const [flow, setFlow] = useState<Flow>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Redirect if already authenticated
  if (authLoading) {
    return <PageLoader />;
  }

  if (isAuthenticated) {
    router.replace("/chat");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await signIn("password", { email, password, flow });
      track(flow === "signIn" ? "login_completed" : "signup_completed", { method: "password" });
      router.replace("/chat");
    } catch {
      if (flow === "signIn") {
        track("login_failed", { error: "invalid_credentials" });
        setError("Invalid email or password.");
      } else {
        setError("Could not create account. The email may already be in use.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-6">
      <style dangerouslySetInnerHTML={{ __html: LOGIN_STYLES }} />

      {/* Animated orb */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div
          className="login-orb h-[500px] w-[500px] rounded-full blur-[120px] sm:h-[600px] sm:w-[600px]"
          style={{
            background:
              "conic-gradient(from 0deg, oklch(0.78 0.154 195), oklch(0.65 0.19 265), oklch(0.6 0.22 300), oklch(0.78 0.154 195))",
            animation: "float-orb-login 20s ease-in-out infinite",
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        {/* Wordmark — links back to landing */}
        <Link
          href="/"
          className="mb-10 block text-center text-2xl font-bold tracking-tight"
          style={{
            background: "linear-gradient(135deg, oklch(0.78 0.154 195), oklch(0.6 0.22 300))",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          tonal.coach
        </Link>
        <h1 className="sr-only">
          {flow === "signIn" ? "Sign in to tonal.coach" : "Create a tonal.coach account"}
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
            <div className="mb-8 text-center">
              <h2 className="text-xl font-semibold text-foreground">
                {flow === "signIn" ? "Welcome back" : "Create your account"}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {flow === "signIn" ? "Sign in to your account" : "Get started with your AI coach"}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                  disabled={submitting}
                  aria-describedby={error ? "login-error" : undefined}
                  className="h-11 rounded-xl px-4 text-base"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  minLength={flow === "signUp" ? 8 : undefined}
                  autoComplete={flow === "signIn" ? "current-password" : "new-password"}
                  disabled={submitting}
                  aria-describedby={error ? "login-error" : undefined}
                  className="h-11 rounded-xl px-4 text-base"
                />
              </div>

              {error && (
                <div id="login-error">
                  <ErrorAlert message={error} />
                </div>
              )}

              <Button
                type="submit"
                className="h-11 w-full text-base shadow-lg shadow-primary/25 transition-all duration-300 hover:shadow-xl hover:shadow-primary/40"
                size="lg"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-5 animate-spin" />
                    <span className="sr-only">
                      {flow === "signIn" ? "Signing in..." : "Signing up..."}
                    </span>
                  </>
                ) : flow === "signIn" ? (
                  "Sign In"
                ) : (
                  "Sign Up"
                )}
              </Button>
            </form>

            {flow === "signUp" && (
              <p className="mt-3 text-center text-[11px] leading-relaxed text-muted-foreground/70">
                By signing up you agree to our{" "}
                <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link
                  href="/privacy"
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  Privacy Policy
                </Link>
                .
              </p>
            )}

            {flow === "signIn" && (
              <div className="mt-4 text-center">
                <Link
                  href="/reset-password"
                  className="text-sm text-primary underline underline-offset-4 transition-colors duration-300 hover:text-primary/80"
                >
                  Forgot your password?
                </Link>
              </div>
            )}

            <p className="mt-8 text-center text-sm text-muted-foreground">
              {flow === "signIn" ? (
                <>
                  Don&apos;t have an account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setFlow("signUp");
                      setError(null);
                    }}
                    className="font-medium text-primary underline decoration-primary/40 underline-offset-4 transition-colors duration-300 hover:decoration-primary"
                  >
                    Sign up
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setFlow("signIn");
                      setError(null);
                    }}
                    className="font-medium text-primary underline decoration-primary/40 underline-offset-4 transition-colors duration-300 hover:decoration-primary"
                  >
                    Sign in
                  </button>
                </>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
