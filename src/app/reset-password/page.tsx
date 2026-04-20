"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorAlert } from "@/components/ErrorAlert";
import { useAnalytics } from "@/lib/analytics";
import { ArrowLeft, CheckCircle2, Loader2, Mail, ShieldCheck } from "lucide-react";
import { AuthShell } from "@/app/_components/AuthShell";

type ResetStep = "enter-email" | "enter-code" | "success";

const RESET_STYLES = `
  @keyframes reset-fade-in {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .reset-fade-in {
    animation: reset-fade-in 300ms ease-out forwards;
  }
  @media (prefers-reduced-motion: reduce) {
    .reset-fade-in { animation: none; opacity: 1; }
  }
`;

export default function ResetPasswordPage() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const { track } = useAnalytics();

  const [step, setStep] = useState<ResetStep>("enter-email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await signIn("password", { email, flow: "reset" });
      track("password_reset_requested");
      setStep("enter-code");
    } catch (err) {
      console.error("[reset-password] send failed:", err);
      setError("Could not send reset code. Please check your email and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);

    try {
      await signIn("password", {
        email,
        code,
        newPassword,
        flow: "reset-verification",
      });
      track("password_reset_completed");
      setStep("success");
    } catch (err) {
      console.error("[reset-password] verify failed:", err);
      setError("Invalid or expired code. Please check the code and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell>
      <style dangerouslySetInnerHTML={{ __html: RESET_STYLES }} />
      {step === "enter-email" && (
        <div className="reset-fade-in">
          <div className="mb-6 flex justify-center">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10">
              <Mail className="size-6 text-primary" />
            </div>
          </div>

          <div className="mb-6 text-center">
            <h2 className="text-xl font-semibold text-foreground">Reset your password</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Enter your email and we&apos;ll send you a verification code.
            </p>
          </div>

          <form onSubmit={handleSendCode} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="reset-email" className="text-sm font-medium">
                Email
              </Label>
              <Input
                id="reset-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                disabled={submitting}
                className="h-11 rounded-xl px-4 text-base"
              />
            </div>

            {error && <ErrorAlert message={error} />}

            <Button
              type="submit"
              className="h-11 w-full text-base shadow-lg shadow-primary/25 transition-all duration-300 hover:shadow-xl hover:shadow-primary/40"
              size="lg"
              disabled={submitting}
            >
              {submitting ? <Loader2 className="size-5 animate-spin" /> : "Send Reset Code"}
            </Button>
          </form>

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
      )}

      {step === "enter-code" && (
        <div className="reset-fade-in">
          <div className="mb-6 flex justify-center">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10">
              <ShieldCheck className="size-6 text-primary" />
            </div>
          </div>

          <div className="mb-6 text-center">
            <h2 className="text-xl font-semibold text-foreground">Check your email</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              We sent a verification code to{" "}
              <span className="font-medium text-foreground">{email}</span>
            </p>
          </div>

          <form onSubmit={handleVerifyCode} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="reset-code" className="text-sm font-medium">
                Verification code
              </Label>
              <Input
                id="reset-code"
                type="text"
                inputMode="numeric"
                maxLength={8}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="Enter code"
                required
                autoComplete="one-time-code"
                disabled={submitting}
                className="h-11 rounded-xl px-4 text-center text-lg tracking-widest"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reset-new-password" className="text-sm font-medium">
                New password
              </Label>
              <Input
                id="reset-new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
                minLength={8}
                autoComplete="new-password"
                disabled={submitting}
                className="h-11 rounded-xl px-4 text-base"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reset-confirm-password" className="text-sm font-medium">
                Confirm new password
              </Label>
              <Input
                id="reset-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                required
                minLength={8}
                autoComplete="new-password"
                disabled={submitting}
                className="h-11 rounded-xl px-4 text-base"
              />
            </div>

            {error && <ErrorAlert message={error} />}

            <Button
              type="submit"
              className="h-11 w-full text-base shadow-lg shadow-primary/25 transition-all duration-300 hover:shadow-xl hover:shadow-primary/40"
              size="lg"
              disabled={submitting}
            >
              {submitting ? <Loader2 className="size-5 animate-spin" /> : "Reset Password"}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => {
                setStep("enter-email");
                setCode("");
                setNewPassword("");
                setConfirmPassword("");
                setError(null);
              }}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline decoration-primary/40 underline-offset-4 transition-colors duration-300 hover:decoration-primary"
            >
              <ArrowLeft className="size-3.5" />
              Use a different email
            </button>
          </div>
        </div>
      )}

      {step === "success" && (
        <div className="reset-fade-in">
          <div className="mb-6 flex justify-center">
            <div className="flex size-12 items-center justify-center rounded-xl bg-green-500/10">
              <CheckCircle2 className="size-6 text-green-500" />
            </div>
          </div>

          <div className="mb-6 text-center">
            <h2 className="text-xl font-semibold text-foreground">Password reset successfully</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Your password has been updated. You can now sign in with your new password.
            </p>
          </div>

          <Button
            className="h-11 w-full text-base shadow-lg shadow-primary/25 transition-all duration-300 hover:shadow-xl hover:shadow-primary/40"
            size="lg"
            onClick={() => router.push("/login")}
          >
            Sign In
          </Button>
        </div>
      )}
    </AuthShell>
  );
}
