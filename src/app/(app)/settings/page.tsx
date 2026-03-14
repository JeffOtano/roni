"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
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
import { ErrorAlert } from "@/components/ErrorAlert";
import { CheckInPreferences } from "@/components/settings/CheckInPreferences";
import { McpKeyManager } from "@/components/settings/McpKeyManager";
import { ChangePassword } from "@/components/settings/ChangePassword";
import { PhotoAnalysisToggle } from "@/components/settings/PhotoAnalysisToggle";
import { DataExport } from "@/components/settings/DataExport";
import { DeleteAccount } from "@/components/settings/DeleteAccount";
import { Link2, LogOut } from "lucide-react";

const SECTION_HEADING =
  "mb-3 border-l-2 border-primary/40 pl-3 text-sm font-semibold text-muted-foreground";

export default function SettingsPage() {
  const { signOut } = useAuthActions();
  const router = useRouter();
  const me = useQuery(api.users.getMe, {});
  const [signOutOpen, setSignOutOpen] = useState(false);

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
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-10">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Settings</h1>
      </div>

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
      </section>

      {/* Password */}
      <section className="mb-10">
        <h2 className={SECTION_HEADING}>Password</h2>
        <ChangePassword />
      </section>

      {/* Tonal Connection */}
      <section className="mb-10">
        <h2 className={SECTION_HEADING}>Tonal Connection</h2>
        <Card>
          <CardContent className="p-4">
            {me?.hasTonalProfile ? (
              <div className="flex items-center gap-3">
                <span className="relative flex size-2.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-400 opacity-60" />
                  <span className="relative inline-flex size-2.5 rounded-full bg-green-500 shadow-[0_0_6px_rgba(74,222,128,0.4)]" />
                </span>
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
                <Button
                  variant="outline"
                  size="sm"
                  className="transition-all duration-200 hover:border-primary/40"
                  onClick={() => router.push("/connect-tonal")}
                >
                  Connect
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Check-in Preferences */}
      <section className="mb-10" id="check-ins">
        <h2 className={SECTION_HEADING}>Check-in Preferences</h2>
        <CheckInPreferences />
      </section>

      {/* Photo Analysis */}
      <section className="mb-10">
        <h2 className={SECTION_HEADING}>Photo Analysis</h2>
        <PhotoAnalysisToggle />
      </section>

      {/* Claude Integration */}
      <section className="mb-10">
        <h2 className={SECTION_HEADING}>Claude Integration</h2>
        <McpKeyManager />
      </section>

      {/* Data Export */}
      <section className="mb-10">
        <h2 className={SECTION_HEADING}>Data Export</h2>
        <DataExport />
      </section>

      {/* About */}
      <section className="mb-10">
        <h2 className={SECTION_HEADING}>About</h2>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">
              tonal.coach is an independent project, not affiliated with Tonal.
            </p>
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
