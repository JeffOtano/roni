"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAction, useConvexAuth, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAnalytics } from "@/lib/analytics";
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
  const { track } = useAnalytics();
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
      track("tonal_connected");
      setPhase("done");
      const destination = isReconnecting ? "/dashboard" : "/onboarding";
      setTimeout(() => router.replace(destination), 600);
    } catch {
      track("tonal_connection_failed", {
        error: "Connection failed",
      });
      setPhase("idle");
      setError(
        "Something went wrong connecting your Tonal account. Please try again or contact support.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[400px] w-[600px] rounded-full bg-primary/8 blur-[120px]" />
      </div>
      <Card className="relative z-10 w-full max-w-sm">
        <CardHeader className="text-center">
          <div
            className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl shadow-lg shadow-primary/10"
            style={{
              background: "linear-gradient(135deg, oklch(0.78 0.154 195), oklch(0.6 0.22 300))",
            }}
          >
            <Link2 className="size-6 text-white" />
          </div>
          <CardTitle className="text-2xl tracking-tight">
            {isReconnecting ? "Reconnect Your Tonal" : "Connect Your Tonal"}
          </CardTitle>
          <CardDescription className="leading-relaxed">
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
