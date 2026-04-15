import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ExerciseListWithSupersets, ExerciseRow } from "./components";
import type { ScheduleExercise } from "../../../../../convex/schedule";

function renderRow(exercise: ScheduleExercise) {
  return render(
    <ul>
      <ExerciseRow exercise={exercise} index={0} />
    </ul>,
  );
}

describe("ExerciseRow", () => {
  it("renders sets × reps for rep-based exercises", () => {
    renderRow({ name: "Barbell Bench Press", sets: 4, reps: 10 });

    expect(screen.getByText("Barbell Bench Press")).toBeInTheDocument();
    expect(screen.getByText(/4\s*×\s*10/)).toBeInTheDocument();
  });

  it("renders sets × duration for duration-based exercises", () => {
    renderRow({ name: "Plank", sets: 3, durationSeconds: 45 });

    expect(screen.getByText(/3\s*×\s*45s/)).toBeInTheDocument();
  });

  it("shows '--' when both reps and duration are missing", () => {
    renderRow({ name: "Mystery", sets: 2 });

    expect(screen.getByText(/2\s*×\s*--/)).toBeInTheDocument();
  });

  it("shows a badge for each active dynamic mode", () => {
    renderRow({
      name: "Bench Press",
      sets: 4,
      reps: 10,
      eccentric: true,
      chains: true,
      burnout: true,
      dropSet: true,
      spotter: true,
    });

    expect(screen.getByText("Eccentric")).toBeInTheDocument();
    expect(screen.getByText("Chains")).toBeInTheDocument();
    expect(screen.getByText("Burnout")).toBeInTheDocument();
    expect(screen.getByText("Drop Set")).toBeInTheDocument();
    expect(screen.getByText("Spotter")).toBeInTheDocument();
  });

  it("renders no mode badges when no modifiers are set", () => {
    renderRow({ name: "Bench Press", sets: 4, reps: 10 });

    expect(screen.queryByText("Eccentric")).toBeNull();
    expect(screen.queryByText("Chains")).toBeNull();
    expect(screen.queryByText("Burnout")).toBeNull();
    expect(screen.queryByText("Drop Set")).toBeNull();
    expect(screen.queryByText("Spotter")).toBeNull();
  });

  it("highlights the row with an amber ring when a dynamic weight mode is active", () => {
    const { container } = renderRow({
      name: "Bench Press",
      sets: 4,
      reps: 10,
      eccentric: true,
    });

    const row = container.querySelector("li");
    expect(row?.className).toMatch(/ring-amber-500/);
  });

  it("does not apply the amber ring for spotter alone", () => {
    const { container } = renderRow({
      name: "Bench Press",
      sets: 4,
      reps: 10,
      spotter: true,
    });

    const row = container.querySelector("li");
    expect(row?.className).not.toMatch(/ring-amber-500/);
  });
});

describe("ExerciseListWithSupersets", () => {
  it("renders straight sets without any superset wrapper", () => {
    render(
      <ExerciseListWithSupersets
        dayName="Monday"
        exercises={[
          { name: "Bench Press", sets: 4, reps: 10 },
          { name: "Overhead Press", sets: 4, reps: 10 },
        ]}
      />,
    );

    expect(screen.queryByText(/Superset/)).toBeNull();
    expect(screen.getByText("Bench Press")).toBeInTheDocument();
    expect(screen.getByText("Overhead Press")).toBeInTheDocument();
  });

  it("wraps consecutive same-group exercises in a Superset container", () => {
    render(
      <ExerciseListWithSupersets
        dayName="Monday"
        exercises={[
          { name: "Bench Press", sets: 4, reps: 10, supersetGroup: 1 },
          { name: "Cable Fly", sets: 4, reps: 12, supersetGroup: 1 },
          { name: "Overhead Press", sets: 4, reps: 10 },
        ]}
      />,
    );

    expect(screen.getByLabelText("Superset 1")).toBeInTheDocument();
    expect(screen.getByText(/Superset · 2 exercises/)).toBeInTheDocument();
  });

  it("renders separate superset clusters for different group numbers", () => {
    render(
      <ExerciseListWithSupersets
        dayName="Monday"
        exercises={[
          { name: "Bench Press", sets: 4, reps: 10, supersetGroup: 1 },
          { name: "Cable Fly", sets: 4, reps: 12, supersetGroup: 1 },
          { name: "Skull Crusher", sets: 3, reps: 12, supersetGroup: 2 },
          { name: "Tricep Pushdown", sets: 3, reps: 12, supersetGroup: 2 },
        ]}
      />,
    );

    expect(screen.getByLabelText("Superset 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Superset 2")).toBeInTheDocument();
  });

  it("keeps exercise numbering continuous across supersets and straight sets", () => {
    render(
      <ExerciseListWithSupersets
        dayName="Monday"
        exercises={[
          { name: "Bench Press", sets: 4, reps: 10, supersetGroup: 1 },
          { name: "Cable Fly", sets: 4, reps: 12, supersetGroup: 1 },
          { name: "Overhead Press", sets: 4, reps: 10 },
        ]}
      />,
    );

    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("falls back to a straight row when a superset group contains only one exercise", () => {
    render(
      <ExerciseListWithSupersets
        dayName="Monday"
        exercises={[
          { name: "Bench Press", sets: 4, reps: 10, supersetGroup: 1 },
          { name: "Overhead Press", sets: 4, reps: 10 },
          { name: "Cable Fly", sets: 4, reps: 12, supersetGroup: 1 },
        ]}
      />,
    );

    // Neither isolated supersetGroup-tagged exercise forms a cluster on its own.
    expect(screen.queryByText(/Superset ·/)).toBeNull();
    expect(screen.getByText("Bench Press")).toBeInTheDocument();
    expect(screen.getByText("Cable Fly")).toBeInTheDocument();
  });
});
