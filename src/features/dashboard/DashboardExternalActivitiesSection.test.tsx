import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { DashboardExternalActivity } from "../../../convex/dashboard";
import { DashboardExternalActivitiesSection } from "./DashboardExternalActivitiesSection";

function makeActivity(
  overrides: Partial<DashboardExternalActivity> = {},
): DashboardExternalActivity {
  return {
    id: "activity-1",
    workoutType: "PICKLEBALL",
    beginTime: "2026-04-11T13:05:19.000Z",
    totalDuration: 7238,
    source: "garmin",
    ...overrides,
  };
}

describe("DashboardExternalActivitiesSection", () => {
  it("separates Garmin activities from other external activities", () => {
    render(
      <DashboardExternalActivitiesSection
        activities={[
          makeActivity(),
          makeActivity({
            id: "apple-1",
            workoutType: "RUNNING",
            source: "appleHealth",
          }),
        ]}
      />,
    );

    expect(screen.getByText("Garmin Activities")).toBeInTheDocument();
    expect(screen.getByText("Other Activities")).toBeInTheDocument();
    expect(screen.getByText("Pickleball")).toBeInTheDocument();
    expect(screen.getByText("Running")).toBeInTheDocument();
    expect(screen.getByText("Apple Health")).toBeInTheDocument();
  });

  it("keeps a Garmin-specific empty state", () => {
    render(<DashboardExternalActivitiesSection activities={[]} />);

    expect(screen.getByText("Garmin Activities")).toBeInTheDocument();
    expect(screen.getByText("No Garmin activities yet.")).toBeInTheDocument();
    expect(screen.queryByText("Other Activities")).not.toBeInTheDocument();
  });
});
