"use client";

import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { usePageView } from "@/lib/analytics";
import { api } from "../../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CheckInPreferences } from "@/features/settings/CheckInPreferences";
import { ChangePassword } from "@/features/settings/ChangePassword";
import { EmailChange } from "@/features/settings/EmailChange";
import { EquipmentSettings } from "@/features/settings/EquipmentSettings";
import { DataExport } from "@/features/settings/DataExport";
import { DeleteAccount } from "@/features/settings/DeleteAccount";
import { ProfileCard } from "@/features/settings/ProfileCard";
import {
  TonalConnectionCard,
  type TonalConnectionState,
} from "@/features/settings/TonalConnectionCard";
import { GeminiKeySection } from "@/features/byok/GeminiKeySection";
import { DISCORD_URL, REPO_URL } from "@/lib/urls";
import { LogOut, MessageSquare } from "lucide-react";
import Link from "next/link";

const SECTION_HEADING =
  "mb-3 border-l-2 border-primary/40 pl-3 text-sm font-semibold text-muted-foreground";

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsPageInner />
    </Suspense>
  );
}

function SettingsPageInner() {
  usePageView("settings_viewed");
  const { signOut } = useAuthActions();
  const router = useRouter();
  const me = useQuery(api.users.getMe, {});
  const [signOutOpen, setSignOutOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    router.replace("/login");
  };

  const tonalConnection: TonalConnectionState = !me?.hasTonalProfile
    ? { state: "disconnected" }
    : me.tonalEmail
      ? {
          state: "connected",
          tonalEmail: me.tonalEmail,
          tonalName: me.tonalName,
          tonalTokenExpired: me.tonalTokenExpired ?? false,
        }
      : {
          state: "connectedWithoutEmail",
          tonalName: me.tonalName,
          tonalTokenExpired: me.tonalTokenExpired ?? false,
        };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-10">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Settings</h1>
      </div>

      {/* Profile */}
      <ProfileCard />

      {/* Account */}
      <section className="mb-10">
        <h2 className={SECTION_HEADING}>Account</h2>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">Email</p>
                <p className="text-sm text-muted-foreground">{me?.email ?? "Unknown"}</p>
              </div>
              <Dialog open={signOutOpen} onOpenChange={setSignOutOpen}>
                <DialogTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-muted-foreground transition-colors duration-200 hover:text-destructive"
                    />
                  }
                >
                  <LogOut className="size-3.5" />
                  Sign Out
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Sign out of tonal.coach?</DialogTitle>
                    <DialogDescription>
                      You&apos;ll need to sign in again to access your coaching data.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
                    <Button variant="destructive" onClick={handleSignOut}>
                      Sign Out
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>
        <div className="mt-3">
          <EmailChange currentEmail={me?.email ?? "Unknown"} />
        </div>
      </section>

      {/* Password */}
      <section className="mb-10">
        <h2 className={SECTION_HEADING}>Password</h2>
        <ChangePassword />
      </section>

      {/* Tonal Connection */}
      <section className="mb-10">
        <h2 className={SECTION_HEADING}>Tonal Connection</h2>
        <TonalConnectionCard connection={tonalConnection} />
      </section>

      {/* Equipment */}
      <section className="mb-10">
        <h2 className={SECTION_HEADING}>Equipment</h2>
        <EquipmentSettings />
      </section>

      {/* Check-in Preferences */}
      <section className="mb-10" id="check-ins">
        <h2 className={SECTION_HEADING}>Check-in Preferences</h2>
        <CheckInPreferences />
      </section>

      {/* Gemini API Key */}
      <section className="mb-10">
        <h2 className={SECTION_HEADING}>Gemini API Key</h2>
        <GeminiKeySection />
      </section>

      {/* Data Export */}
      <section className="mb-10">
        <h2 className={SECTION_HEADING}>Data Export</h2>
        <DataExport />
      </section>

      {/* About & Support */}
      <section className="mb-10">
        <h2 className={SECTION_HEADING}>About & Support</h2>
        <Card>
          <CardContent className="space-y-3 p-4">
            <p className="text-sm text-muted-foreground">
              tonal.coach is an independent project, not affiliated with Tonal.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                nativeButton={false}
                render={<Link href="/contact" />}
              >
                <MessageSquare className="size-3.5" />
                Contact Us
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                nativeButton={false}
                render={<a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" />}
              >
                Discord
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                nativeButton={false}
                render={<a href={REPO_URL} target="_blank" rel="noopener noreferrer" />}
              >
                GitHub
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Danger Zone */}
      <section className="mb-10">
        <h2 className="mb-3 border-l-2 border-destructive/40 pl-3 text-sm font-semibold text-destructive/80">
          Danger Zone
        </h2>
        <DeleteAccount />
      </section>
    </div>
  );
}
