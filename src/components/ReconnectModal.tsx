"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAnalytics } from "@/lib/analytics";
import { CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type ReconnectModalProps = {
  tonalEmail: string;
  open: boolean;
  onDismiss: () => void;
};

export function ReconnectModal({ tonalEmail, open, onDismiss }: ReconnectModalProps) {
  const { track } = useAnalytics();
  const connectTonal = useAction(api.tonal.connectPublic.connectTonal);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "submitting" | "success">("idle");
  const passwordRef = useRef<HTMLInputElement>(null);

  // Auto-close after success with a brief delay so the user sees confirmation
  useEffect(() => {
    if (phase !== "success") return;
    const timer = setTimeout(() => {
      setPassword("");
      setError(null);
      setPhase("idle");
      onDismiss();
    }, 800);
    return () => clearTimeout(timer);
  }, [phase, onDismiss]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && phase !== "submitting") {
      setPassword("");
      setError(null);
      setPhase("idle");
      onDismiss();
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPhase("submitting");

    try {
      await connectTonal({ tonalEmail, tonalPassword: password });
      track("tonal_reconnected");
      setPhase("success");
    } catch {
      track("tonal_reconnect_failed", { error: "Wrong password" });
      setError("Wrong password. Please try again.");
      setPhase("idle");
      passwordRef.current?.focus();
    }
  }

  const isSubmitting = phase === "submitting";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[360px]">
        <DialogHeader className="items-center text-center">
          <div
            className="mb-1 flex size-12 items-center justify-center rounded-2xl shadow-lg shadow-primary/10"
            style={{
              background: "linear-gradient(135deg, oklch(0.78 0.154 195), oklch(0.6 0.22 300))",
            }}
          >
            {phase === "success" ? (
              <CheckCircle2 className="size-5 text-white motion-safe:animate-in motion-safe:zoom-in-50 motion-safe:duration-300" />
            ) : (
              <RefreshCw className="size-5 text-white" />
            )}
          </div>
          <DialogTitle className="text-lg">
            {phase === "success" ? "Connected!" : "Let\u2019s get you reconnected"}
          </DialogTitle>
          <DialogDescription>
            {phase === "success"
              ? "You\u2019re all set. Getting back to it\u2026"
              : "Enter your Tonal password and you\u2019ll be back in seconds."}
          </DialogDescription>
        </DialogHeader>

        {phase !== "success" && (
          <form id="reconnect-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="flex justify-center">
              <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                {tonalEmail}
              </span>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reconnect-password" className="sr-only">
                Tonal Password
              </Label>
              <Input
                ref={passwordRef}
                id="reconnect-password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Tonal password"
                required
                autoComplete="off"
                disabled={isSubmitting}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "reconnect-error" : undefined}
              />
              {error && (
                <p id="reconnect-error" className="text-xs text-destructive" role="alert">
                  {error}
                </p>
              )}
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={isSubmitting || !password}>
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  Reconnecting...
                </span>
              ) : (
                "Reconnect"
              )}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
