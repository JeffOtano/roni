import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ExerciseList } from "./ExerciseList";

describe("ExerciseList", () => {
  it("renders the empty state when no exercises are provided", () => {
    render(<ExerciseList exercises={[]} dayName="Monday" />);

    expect(screen.getByText(/exercises will appear once programmed/i)).toBeInTheDocument();
  });

  it("renders sets × reps for rep-based exercises", () => {
    render(
      <ExerciseList exercises={[{ name: "Bench Press", sets: 4, reps: 10 }]} dayName="Monday" />,
    );

    expect(screen.getByText("Bench Press")).toBeInTheDocument();
    expect(screen.getByText(/4\s*×\s*10/)).toBeInTheDocument();
  });

  it("renders sets × duration for duration-based exercises", () => {
    render(
      <ExerciseList
        exercises={[{ name: "Plank", sets: 3, durationSeconds: 45 }]}
        dayName="Monday"
      />,
    );

    expect(screen.getByText(/3\s*×\s*45s/)).toBeInTheDocument();
  });

  it("shows a dynamic mode dot and combined tooltip when modifiers are active", () => {
    render(
      <ExerciseList
        exercises={[
          {
            name: "Bench Press",
            sets: 4,
            reps: 10,
            eccentric: true,
            chains: true,
          },
        ]}
        dayName="Monday"
      />,
    );

    const dot = screen.getByLabelText(/dynamic mode: eccentric, chains/i);
    expect(dot).toBeInTheDocument();
  });

  it("does not render a dynamic mode dot when no modifiers are active", () => {
    render(
      <ExerciseList exercises={[{ name: "Bench Press", sets: 4, reps: 10 }]} dayName="Monday" />,
    );

    expect(screen.queryByLabelText(/dynamic mode:/i)).toBeNull();
  });

  it("does not highlight for spotter alone", () => {
    render(
      <ExerciseList
        exercises={[{ name: "Bench Press", sets: 4, reps: 10, spotter: true }]}
        dayName="Monday"
      />,
    );

    expect(screen.queryByLabelText(/dynamic mode:/i)).toBeNull();
  });

  it("truncates exercises past the visible limit and shows a +N more label", () => {
    const exercises = Array.from({ length: 6 }, (_, i) => ({
      name: `Exercise ${i + 1}`,
      sets: 3,
      reps: 10,
    }));

    render(<ExerciseList exercises={exercises} dayName="Monday" />);

    expect(screen.getByText("Exercise 1")).toBeInTheDocument();
    expect(screen.getByText("Exercise 4")).toBeInTheDocument();
    expect(screen.queryByText("Exercise 5")).toBeNull();
    expect(screen.getByText("+2 more")).toBeInTheDocument();
  });
});
