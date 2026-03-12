"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Link2 } from "lucide-react";

export default function ConnectTonalPage() {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const router = useRouter();
  const connectTonal = useAction(api.tonal.connectPublic.connectTonal);

  const [tonalEmail, setTonalEmail] = useState("");
  const [tonalPassword, setTonalPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Auth loading state
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    router.replace("/login");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await connectTonal({ tonalEmail, tonalPassword });
      router.replace("/chat");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to connect Tonal account";
      if (
        message.toLowerCase().includes("unauthorized") ||
        message.toLowerCase().includes("invalid") ||
        message.toLowerCase().includes("credentials")
      ) {
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
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full border border-border bg-card">
            <Link2 className="size-5 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground">
            Connect Your Tonal
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Link your Tonal account to get personalized coaching based on your
            real training data.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="tonal-email"
              className="text-sm font-medium text-foreground"
            >
              Tonal Email
            </label>
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
            <label
              htmlFor="tonal-password"
              className="text-sm font-medium text-foreground"
            >
              Tonal Password
            </label>
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

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span className="ml-2">Connecting...</span>
              </>
            ) : (
              "Connect Tonal"
            )}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Your Tonal password is used only to obtain an authentication token. We
          do not store your password.
        </p>
      </div>
    </div>
  );
}
