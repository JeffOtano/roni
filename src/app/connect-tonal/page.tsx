"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAction, useConvexAuth, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageLoader } from "@/components/PageLoader";
import { ErrorAlert } from "@/components/ErrorAlert";
import { CheckCircle2, Link2, Loader2 } from "lucide-react";

const PHASE_LABELS = {
  authenticating: "Authenticating...",
  syncing: "Syncing profile...",
  done: "Done!",
} as const;

export default function ConnectTonalPage() {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const router = useRouter();
  const connectTonal = useAction(api.tonal.connectPublic.connectTonal);
  const me = useQuery(api.users.getMe);
  const isReconnecting = me?.hasTonalProfile && me?.tonalTokenExpired;

  const [tonalEmail, setTonalEmail] = useState("");
  const [tonalPassword, setTonalPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [phase, setPhase] = useState<"idle" | "authenticating" | "syncing" | "done">("idle");

  if (authLoading) {
    return <PageLoader />;
  }

  if (!isAuthenticated) {
    router.replace("/login");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    setPhase("authenticating");

    try {
      const phaseTimer = setTimeout(() => setPhase("syncing"), 1500);
      await connectTonal({ tonalEmail, tonalPassword });
      clearTimeout(phaseTimer);
      setPhase("done");
      setTimeout(() => router.replace("/onboarding"), 600);
    } catch (err) {
      setPhase("idle");
      const message = err instanceof Error ? err.message : "Failed to connect Tonal account";
      const isCredentialError = /unauthorized|invalid|credentials/i.test(message);
      if (isCredentialError) {
        setError("Invalid Tonal credentials. Please check your email and password.");
      } else {
        setError(message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full border border-border bg-muted">
            <Link2 className="size-5 text-muted-foreground" />
          </div>
          <CardTitle className="text-2xl">
            {isReconnecting ? "Reconnect Your Tonal" : "Connect Your Tonal"}
          </CardTitle>
          <CardDescription>
            {isReconnecting
              ? "Your session expired. Sign in again to restore access to your training data."
              : "Link your Tonal account to get personalized coaching based on your real training data."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tonal-email">Tonal Email</Label>
              <Input
                id="tonal-email"
                type="email"
                value={tonalEmail}
                onChange={(e) => setTonalEmail(e.target.value)}
                placeholder="your-tonal-email@example.com"
                required
                autoComplete="email"
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tonal-password">Tonal Password</Label>
              <Input
                id="tonal-password"
                type="password"
                value={tonalPassword}
                onChange={(e) => setTonalPassword(e.target.value)}
                placeholder="Enter your Tonal password"
                required
                autoComplete="off"
                disabled={submitting}
              />
            </div>
            {error && <ErrorAlert message={error} />}
            {phase === "done" && (
              <div className="flex items-center justify-center gap-2 rounded-lg bg-green-500/10 px-3 py-2 text-sm text-green-600 dark:text-green-400">
                <CheckCircle2 className="size-4" />
                Connected! Redirecting...
              </div>
            )}
            <Button type="submit" className="w-full" size="lg" disabled={submitting}>
              {phase === "idle" ? (
                isReconnecting ? (
                  "Reconnect"
                ) : (
                  "Connect Tonal"
                )
              ) : (
                <span className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  {PHASE_LABELS[phase]}
                </span>
              )}
            </Button>
          </form>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Your Tonal password is used only to obtain an authentication token. We do not store your
            password.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
