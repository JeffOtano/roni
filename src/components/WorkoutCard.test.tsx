import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WorkoutCard } from "./WorkoutCard";

describe("WorkoutCard", () => {
  it("renders workout title when provided", () => {
    render(<WorkoutCard title="Upper Body Blast" />);

    expect(screen.getByText("Upper Body Blast")).toBeInTheDocument();
  });

  it("renders 'Custom Workout' when no title is provided", () => {
    render(<WorkoutCard />);

    expect(screen.getByText("Custom Workout")).toBeInTheDocument();
  });

  it("renders exercise list with exercise names", () => {
    const exercises = [{ exerciseName: "Bench Press" }, { exerciseName: "Squat" }];

    render(<WorkoutCard exercises={exercises} />);

    expect(screen.getByText("Bench Press")).toBeInTheDocument();
    expect(screen.getByText("Squat")).toBeInTheDocument();
  });

  it("uses name field when exerciseName is not present", () => {
    const exercises = [{ name: "Deadlift" }];

    render(<WorkoutCard exercises={exercises} />);

    expect(screen.getByText("Deadlift")).toBeInTheDocument();
  });

  it("shows sets x reps for exercises that have both", () => {
    const exercises = [{ exerciseName: "Bench Press", sets: 4, reps: 8 }];

    render(<WorkoutCard exercises={exercises} />);

    // The component renders {sets}×{reps} as separate text nodes
    expect(screen.getByText(/4/)).toBeInTheDocument();
    expect(screen.getByText(/8/)).toBeInTheDocument();
  });

  it("shows exercise count", () => {
    const exercises = [
      { exerciseName: "Bench Press" },
      { exerciseName: "Squat" },
      { exerciseName: "Deadlift" },
    ];

    render(<WorkoutCard exercises={exercises} />);

    expect(screen.getByText("3 exercises")).toBeInTheDocument();
  });

  it("shows estimated duration in minutes", () => {
    render(<WorkoutCard estimatedDuration={3600} />);

    expect(screen.getByText("~60 min")).toBeInTheDocument();
  });

  it("does not show duration when estimatedDuration is zero", () => {
    render(<WorkoutCard estimatedDuration={0} />);

    expect(screen.queryByText(/min/)).toBeNull();
  });

  it("does not show exercise count when exercises array is empty", () => {
    render(<WorkoutCard exercises={[]} />);

    expect(screen.queryByText(/exercises/)).toBeNull();
  });

  it("does not show exercise list when exercises is undefined", () => {
    const { container } = render(<WorkoutCard />);

    expect(container.querySelector("ol")).toBeNull();
  });
});
