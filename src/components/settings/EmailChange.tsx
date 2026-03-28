"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAnalytics } from "@/lib/analytics";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, ChevronDown, ChevronRight, Loader2 } from "lucide-react";

type Step = "idle" | "enter-email" | "enter-code" | "success";

export function EmailChange({ currentEmail }: { currentEmail: string }) {
  const { track } = useAnalytics();
  const [expanded, setExpanded] = useState(false);
  const [step, setStep] = useState<Step>("enter-email");
  const [newEmail, setNewEmail] = useState("");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const requestChange = useAction(api.emailChange.requestEmailChange);
  const confirmChange = useAction(api.emailChange.confirmEmailChange);

  function reset() {
    setStep("enter-email");
    setNewEmail("");
    setCode("");
    setError("");
    setSubmitting(false);
  }

  async function handleRequestCode(e: React.FormEvent) {
    e.preventDefault();
    if (newEmail === currentEmail) {
      setError("New email must be different from your current email.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await requestChange({ newEmail });
      track("email_change_requested");
      setStep("enter-code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send verification code.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (code.length < 6) {
      setError("Please enter the verification code.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await confirmChange({ code });
      track("email_change_confirmed");
      setStep("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid or expired code.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-4">
        <button
          type="button"
          onClick={() => {
            setExpanded((v) => !v);
            if (!expanded) reset();
          }}
          className="flex w-full items-center justify-between text-sm font-medium text-foreground transition-colors duration-200 hover:text-primary"
          aria-expanded={expanded}
        >
          Change Email
          {expanded ? (
            <ChevronDown className="size-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 text-muted-foreground" />
          )}
        </button>

        {expanded && step === "enter-email" && (
          <form onSubmit={handleRequestCode} className="mt-4 space-y-4 border-t border-border pt-4">
            <p className="text-xs text-muted-foreground">
              Current email: <span className="font-medium text-foreground">{currentEmail}</span>
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="new-email" className="text-xs text-muted-foreground">
                New email address
              </Label>
              <Input
                id="new-email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="new@example.com"
                autoComplete="email"
                required
              />
            </div>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
              Send verification code
            </Button>
          </form>
        )}

        {expanded && step === "enter-code" && (
          <form onSubmit={handleVerifyCode} className="mt-4 space-y-4 border-t border-border pt-4">
            <p className="text-xs text-muted-foreground">
              We sent a verification code to{" "}
              <span className="font-medium text-foreground">{newEmail}</span>
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="email-code" className="text-xs text-muted-foreground">
                Verification code
              </Label>
              <Input
                id="email-code"
                type="text"
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="Enter code"
                autoComplete="one-time-code"
                required
              />
            </div>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={submitting}>
                {submitting && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
                Verify and update
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setStep("enter-email")}
              >
                Back
              </Button>
            </div>
          </form>
        )}

        {expanded && step === "success" && (
          <div className="mt-4 flex items-center gap-2 border-t border-border pt-4">
            <CheckCircle2 className="size-4 text-green-500" />
            <p className="text-sm text-green-500">Email updated to {newEmail}.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
