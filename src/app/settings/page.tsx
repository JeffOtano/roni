"use client";

import { useRouter } from "next/navigation";
import { useConvexAuth, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  ArrowLeft,
  LogOut,
  Link2,
  CheckCircle2,
} from "lucide-react";

export default function SettingsPage() {
  const { isAuthenticated, isLoading: authLoading } = useConvexAuth();
  const { signOut } = useAuthActions();
  const router = useRouter();
  const me = useQuery(api.users.getMe, isAuthenticated ? {} : "skip");

  // Auth loading
  if (authLoading || (isAuthenticated && me === undefined)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Not authenticated -> login
  if (!isAuthenticated) {
    router.replace("/login");
    return null;
  }

  const handleSignOut = async () => {
    await signOut();
    router.replace("/login");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-lg px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => router.push("/chat")}
            aria-label="Back to chat"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <h1 className="text-xl font-semibold text-foreground">Settings</h1>
        </div>

        {/* Account Section */}
        <section className="mb-6">
          <h2 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Account
          </h2>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Email</p>
                <p className="text-sm text-muted-foreground">
                  {me?.email ?? "Unknown"}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                className="text-destructive hover:text-destructive"
              >
                <LogOut className="mr-1.5 size-3.5" />
                Sign Out
              </Button>
            </div>
          </div>
        </section>

        {/* Tonal Connection Section */}
        <section className="mb-6">
          <h2 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Tonal Connection
          </h2>
          <div className="rounded-lg border border-border bg-card p-4">
            {me?.hasTonalProfile ? (
              <div className="flex items-center gap-3">
                <CheckCircle2 className="size-5 text-green-500" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Connected
                  </p>
                  {me.tonalName && (
                    <p className="text-sm text-muted-foreground">
                      {me.tonalName}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Link2 className="size-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Not Connected
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Link your Tonal account to get started
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push("/connect-tonal")}
                >
                  Connect
                </Button>
              </div>
            )}
          </div>
        </section>

        {/* About Section */}
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wider">
            About
          </h2>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">
              tonal.coach is an independent project, not affiliated with Tonal.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
