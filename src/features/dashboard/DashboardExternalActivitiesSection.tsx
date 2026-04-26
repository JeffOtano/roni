"use client";

import type { DashboardExternalActivity } from "../../../convex/dashboard";
import { EXTERNAL_ACTIVITY_SOURCES } from "../../../convex/tonal/externalActivitySources";
import { ActivityCard } from "@/features/dashboard/ActivityCard";
import { ExternalActivitiesList } from "@/features/dashboard/ExternalActivitiesList";
import { DashboardCardSkeleton } from "@/features/dashboard/DashboardCardSkeleton";

interface DashboardExternalActivitiesSectionProps {
  activities: DashboardExternalActivity[] | undefined;
}

export function DashboardExternalActivitiesSection({
  activities,
}: DashboardExternalActivitiesSectionProps) {
  if (activities === undefined) return <DashboardCardSkeleton />;

  const garminActivities = activities.filter(
    (activity) => activity.source === EXTERNAL_ACTIVITY_SOURCES.GARMIN,
  );
  const otherActivities = activities.filter(
    (activity) => activity.source !== EXTERNAL_ACTIVITY_SOURCES.GARMIN,
  );

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
