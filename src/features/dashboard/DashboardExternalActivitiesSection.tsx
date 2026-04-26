"use client";

import type { ReactNode } from "react";
import type { DashboardExternalActivity } from "../../../convex/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExternalActivitiesList } from "@/features/dashboard/ExternalActivitiesList";
import { DashboardCardSkeleton } from "@/features/dashboard/DashboardCardSkeleton";

function ActivityCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="animate-in fade-in duration-300">
      <CardHeader>
        <CardTitle>
          <span className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            {title}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

interface DashboardExternalActivitiesSectionProps {
  activities: DashboardExternalActivity[] | undefined;
}

export function DashboardExternalActivitiesSection({
  activities,
}: DashboardExternalActivitiesSectionProps) {
  if (activities === undefined) return <DashboardCardSkeleton />;

  const garminActivities: DashboardExternalActivity[] = [];
  const otherActivities: DashboardExternalActivity[] = [];

  for (const activity of activities) {
    if (activity.source.toLowerCase() === "garmin") {
      garminActivities.push(activity);
    } else {
      otherActivities.push(activity);
    }
  }

  return (
    <>
      <ActivityCard title="Garmin Activities">
        <ExternalActivitiesList
          activities={garminActivities}
          emptyMessage="No Garmin activities yet."
          showSource={false}
        />
      </ActivityCard>
      {otherActivities.length > 0 && (
        <ActivityCard title="Other Activities">
          <ExternalActivitiesList activities={otherActivities} />
        </ActivityCard>
      )}
    </>
  );
}
