"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, Dumbbell, Ruler, Weight } from "lucide-react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatHeight(inches: number): string {
  const ft = Math.floor(inches / 12);
  const remainInches = Math.round(inches % 12);
  return `${ft}'${remainInches}"`;
}

// ---------------------------------------------------------------------------
// Metric cell
// ---------------------------------------------------------------------------

function MetricCell({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number | null;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg bg-muted/40 px-3 py-2.5">
      <Icon className="size-4 shrink-0 text-muted-foreground/60" />
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="truncate text-sm font-medium text-foreground">{value ?? "---"}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Profile card
// ---------------------------------------------------------------------------

const SECTION_HEADING =
  "mb-3 border-l-2 border-primary/40 pl-3 text-sm font-semibold text-muted-foreground";

export function ProfileCard() {
  const profile = useQuery(api.account.getFullProfile);

  if (profile === undefined) {
    return (
      <section className="mb-10">
        <h2 className={SECTION_HEADING}>Profile</h2>
        <Skeleton className="h-48 rounded-xl" />
      </section>
    );
  }

  if (profile === null) return null;

  const pd = profile.profileData;
  const initials = profile.tonalName
    ? profile.tonalName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <section className="mb-10">
      <h2 className={SECTION_HEADING}>Profile</h2>
      <Card>
        <CardContent className="p-5">
          {/* Identity row */}
          <div className="flex items-center gap-4">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-bold tracking-tight text-foreground">
                {profile.tonalName ?? "Tonal User"}
              </p>
              {profile.email && (
                <p className="truncate text-sm text-muted-foreground">{profile.email}</p>
              )}
            </div>
            {profile.hasTonalProfile && (
              <div className="flex items-center gap-2">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-400 opacity-60" />
                  <span className="relative inline-flex size-2 rounded-full bg-green-500 shadow-[0_0_6px_rgba(74,222,128,0.4)]" />
                </span>
                <span className="text-xs text-muted-foreground">Connected</span>
              </div>
            )}
          </div>

          {/* Metrics grid */}
          {pd && (
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <MetricCell
                icon={Ruler}
                label="Height"
                value={pd.heightInches ? formatHeight(pd.heightInches) : null}
              />
              <MetricCell
                icon={Weight}
                label="Weight"
                value={pd.weightPounds ? `${pd.weightPounds} lbs` : null}
              />
              <MetricCell icon={Dumbbell} label="Level" value={pd.level ?? null} />
              <MetricCell
                icon={BarChart3}
                label="Goal"
                value={pd.workoutsPerWeek ? `${pd.workoutsPerWeek}x/week` : null}
              />
            </div>
          )}

          {/* Connected date */}
          {profile.tonalConnectedAt && (
            <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
              Tonal connected{" "}
              {new Date(profile.tonalConnectedAt).toLocaleDateString(undefined, {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
