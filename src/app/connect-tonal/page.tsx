"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAction, useConvexAuth } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageLoader } from "@/components/PageLoader";
import { ErrorAlert } from "@/components/ErrorAlert";
import { Link2, Loader2 } from "lucide-react";

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
    return <PageLoader />;
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
      const message = err instanceof Error ? err.message : "Failed to connect Tonal account";
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
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full border border-border bg-muted">
            <Link2 className="size-5 text-muted-foreground" />
          </div>
          <CardTitle className="text-2xl">Connect Your Tonal</CardTitle>
          <CardDescription>
            Link your Tonal account to get personalized coaching based on your real training data.
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

            <Button type="submit" className="w-full" size="lg" disabled={submitting}>
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
            Your Tonal password is used only to obtain an authentication token. We do not store your
            password.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
