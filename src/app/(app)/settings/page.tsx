"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ErrorAlert } from "@/components/ErrorAlert";
import { McpKeyManager } from "@/components/settings/McpKeyManager";
import { CheckCircle2, Link2, LogOut } from "lucide-react";

export default function SettingsPage() {
  const { signOut } = useAuthActions();
  const router = useRouter();
  const me = useQuery(api.users.getMe, {});

  // Authenticated but query returned null (profile missing)
  if (me === null) {
    return (
      <div className="flex items-center justify-center px-4 py-16">
        <ErrorAlert message="Failed to load account data. Please try again." />
      </div>
    );
  }

  const handleSignOut = async () => {
    await signOut();
    router.replace("/login");
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-foreground">Settings</h1>
      </div>

      {/* Account Section */}
      <section className="mb-6">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Account
        </h2>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Email</p>
                <p className="text-sm text-muted-foreground">{me?.email ?? "Unknown"}</p>
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
          </CardContent>
        </Card>
      </section>

      <Separator className="mb-6" />

      {/* Tonal Connection Section */}
      <section className="mb-6">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Tonal Connection
        </h2>
        <Card>
          <CardContent className="p-4">
            {me?.hasTonalProfile ? (
              <div className="flex items-center gap-3">
                <CheckCircle2 className="size-5 text-green-500" />
                <div>
                  <p className="text-sm font-medium text-foreground">Connected</p>
                  {me.tonalName && <p className="text-sm text-muted-foreground">{me.tonalName}</p>}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Link2 className="size-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Not Connected</p>
                    <p className="text-sm text-muted-foreground">
                      Link your Tonal account to get started
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => router.push("/connect-tonal")}>
                  Connect
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <Separator className="mb-6" />

      {/* Claude Integration Section */}
      <section className="mb-6">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Claude Integration
        </h2>
        <McpKeyManager />
      </section>

      <Separator className="mb-6" />

      {/* About Section */}
      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wider">
          About
        </h2>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              tonal.coach is an independent project, not affiliated with Tonal.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
