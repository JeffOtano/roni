import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { DashboardExternalActivity } from "../../../convex/dashboard";
import { ExternalActivitiesList } from "./ExternalActivitiesList";

function makeActivity(
  overrides: Partial<DashboardExternalActivity> = {},
): DashboardExternalActivity {
  return {
    id: "activity-1",
    workoutType: "PICKLEBALL",
    beginTime: "2026-04-11T13:05:19.000Z",
    totalDuration: 7238,
    distance: 1005.95,
    totalCalories: 320,
    averageHeartRate: 113,
    maxHeartRate: 150,
    source: "garmin",
    ...overrides,
  };
}

describe("ExternalActivitiesList", () => {
  it("formats Garmin enum activity names and metrics", () => {
    render(<ExternalActivitiesList activities={[makeActivity()]} showSource={false} />);

    expect(screen.getByText("Pickleball")).toBeInTheDocument();
    expect(screen.getByText("2h 1m")).toBeInTheDocument();
    expect(screen.getByText("0.6 mi")).toBeInTheDocument();
    expect(screen.getByText("113 avg bpm")).toBeInTheDocument();
    expect(screen.getByText("150 max bpm")).toBeInTheDocument();
    expect(screen.queryByText("Garmin")).not.toBeInTheDocument();
  });

  it("normalizes underscore activity names and source labels", () => {
    render(
      <ExternalActivitiesList
        activities={[makeActivity({ workoutType: "STRENGTH_TRAINING", source: "appleHealth" })]}
      />,
    );

    expect(screen.getByText("Strength Training")).toBeInTheDocument();
    expect(screen.getByText("Apple Health")).toBeInTheDocument();
  });

  it("uses a custom empty message", () => {
    render(<ExternalActivitiesList activities={[]} emptyMessage="No Garmin activities yet." />);

    expect(screen.getByText("No Garmin activities yet.")).toBeInTheDocument();
  });
});
