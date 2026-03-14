"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorAlert } from "@/components/ErrorAlert";
import {
  ArrowLeft,
  BarChart3,
  Camera,
  Dumbbell,
  Link2,
  Mail,
  MessageCircle,
  Ruler,
  Settings,
  TrendingUp,
  User,
  Weight,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatHeight(inches: number): string {
  const ft = Math.floor(inches / 12);
  const remainInches = Math.round(inches % 12);
  return `${ft}'${remainInches}"`;
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function ProfileSkeleton() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Skeleton className="mb-8 h-8 w-40" />
      <div className="space-y-4">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Profile info row
// ---------------------------------------------------------------------------

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className="flex items-center gap-3 py-2">
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      <div className="flex-1">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="text-sm text-foreground">{value ?? "Not set"}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ProfilePage() {
  const profile = useQuery(api.account.getFullProfile);

  if (profile === undefined) return <ProfileSkeleton />;

  if (profile === null) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm" className="mb-4 gap-2">
            <ArrowLeft className="size-4" />
            Back to dashboard
          </Button>
        </Link>
        <ErrorAlert message="Failed to load profile data." />
      </div>
    );
  }

  const pd = profile.profileData;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {/* Back button */}
      <Link href="/dashboard">
        <Button variant="ghost" size="sm" className="mb-4 gap-2">
          <ArrowLeft className="size-4" />
          Back to dashboard
        </Button>
      </Link>

      <h1 className="mb-8 text-2xl font-bold tracking-tight text-foreground">Profile</h1>

      {/* User info */}
      <section className="mb-6">
        <h2 className="mb-3 border-l-2 border-primary/40 pl-3 text-sm font-semibold text-muted-foreground">
          Account
        </h2>
        <Card>
          <CardContent className="divide-y divide-white/[0.06] p-4">
            <InfoRow icon={User} label="Name" value={profile.tonalName} />
            <InfoRow icon={Mail} label="Email" value={profile.email} />
          </CardContent>
        </Card>
      </section>

      {/* Profile data */}
      <section className="mb-6">
        <h2 className="mb-3 border-l-2 border-primary/40 pl-3 text-sm font-semibold text-muted-foreground">
          Body Metrics
        </h2>
        <Card>
          <CardContent className="divide-y divide-white/[0.06] p-4">
            <InfoRow
              icon={Ruler}
              label="Height"
              value={pd?.heightInches ? formatHeight(pd.heightInches) : null}
            />
            <InfoRow
              icon={Weight}
              label="Weight"
              value={pd?.weightPounds ? `${pd.weightPounds} lbs` : null}
            />
            <InfoRow icon={Dumbbell} label="Fitness Level" value={pd?.level} />
            <InfoRow icon={BarChart3} label="Workouts/Week Goal" value={pd?.workoutsPerWeek} />
          </CardContent>
        </Card>
      </section>

      {/* Tonal connection */}
      <section className="mb-6">
        <h2 className="mb-3 border-l-2 border-primary/40 pl-3 text-sm font-semibold text-muted-foreground">
          Tonal Connection
        </h2>
        <Card>
          <CardContent className="p-4">
            {profile.hasTonalProfile ? (
              <div className="flex items-center gap-3">
                <span className="relative flex size-2.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-400 opacity-60" />
                  <span className="relative inline-flex size-2.5 rounded-full bg-green-500 shadow-[0_0_6px_rgba(74,222,128,0.4)]" />
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">Connected</p>
                  {profile.tonalConnectedAt && (
                    <p className="text-xs text-muted-foreground">
                      Since{" "}
                      {new Date(profile.tonalConnectedAt).toLocaleDateString(undefined, {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link2 className="size-5 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Not connected</p>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Quick links */}
      <div className="flex flex-wrap gap-3">
        <Link href="/stats">
          <Button variant="outline" size="sm" className="gap-2">
            <BarChart3 className="size-4" />
            View stats
          </Button>
        </Link>
        <Link href="/strength">
          <Button variant="outline" size="sm" className="gap-2">
            <TrendingUp className="size-4" />
            Strength trends
          </Button>
        </Link>
        <Link href="/progress">
          <Button variant="outline" size="sm" className="gap-2">
            <Camera className="size-4" />
            Progress photos
          </Button>
        </Link>
        <Link href="/check-ins">
          <Button variant="outline" size="sm" className="gap-2">
            <MessageCircle className="size-4" />
            Check-ins
          </Button>
        </Link>
        <Link href="/settings">
          <Button variant="outline" size="sm" className="gap-2">
            <Settings className="size-4" />
            Edit settings
          </Button>
        </Link>
      </div>
    </div>
  );
}
