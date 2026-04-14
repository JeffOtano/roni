import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ToolCallIndicator } from "./ToolCallIndicator";

vi.mock("./WeekPlanCard", () => ({
  WeekPlanCard: ({ plan }: { plan: { summary: string } }) => (
    <div data-testid="week-plan-card">{plan.summary}</div>
  ),
}));

describe("ToolCallIndicator", () => {
  it("renders running chip for a state-changing tool in progress", () => {
    render(<ToolCallIndicator toolName="approve_week_plan" state="input-available" />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Pushing workouts to your Tonal...")).toBeInTheDocument();
  });

  it("renders confirmation banner for approve_week_plan on success", () => {
    render(
      <ToolCallIndicator
        toolName="approve_week_plan"
        state="output-available"
        output={{ success: true, pushed: 4, failed: 0, skipped: 3, results: [] }}
      />,
    );

    expect(screen.getByText("4 workouts pushed to Tonal")).toBeInTheDocument();
    expect(
      screen.getByRole("status").querySelector("[data-testid='banner-icon-success']"),
    ).toBeInTheDocument();
  });

  it("renders error banner for approve_week_plan on failure", () => {
    render(
      <ToolCallIndicator
        toolName="approve_week_plan"
        state="output-available"
        output={{ success: false, pushed: 2, failed: 1, skipped: 0, results: [] }}
      />,
    );

    expect(screen.getByText("2 pushed, 1 failed")).toBeInTheDocument();
    expect(
      screen.getByRole("status").querySelector("[data-testid='banner-icon-error']"),
    ).toBeInTheDocument();
  });

  it("renders confirmation banner for swap_exercise on success", () => {
    render(
      <ToolCallIndicator
        toolName="swap_exercise"
        state="output-available"
        output={{ success: true, message: "Swapped" }}
      />,
    );

    expect(screen.getByText("Exercise swapped")).toBeInTheDocument();
  });

  it("falls back to chip when output shape is unexpected", () => {
    render(
      <ToolCallIndicator
        toolName="approve_week_plan"
        state="output-available"
        output="unexpected string"
      />,
    );

    expect(screen.getByText("Workouts pushed to Tonal")).toBeInTheDocument();
  });

  it("renders chip for read-only tools", () => {
    render(<ToolCallIndicator toolName="search_exercises" state="output-available" />);

    expect(screen.getByText("Searched exercises")).toBeInTheDocument();
  });

  it("still renders WeekPlanCard for program_week", () => {
    const output = {
      success: true,
      summary: {
        weekStartDate: "2026-04-14",
        preferredSplit: "ppl",
        days: [
          {
            dayName: "Monday",
            sessionType: "Push",
            estimatedDuration: 45,
            exercises: [{ name: "Bench Press", muscleGroups: ["Chest"], sets: 3, reps: 10 }],
          },
        ],
      },
    };

    render(<ToolCallIndicator toolName="program_week" state="output-available" output={output} />);

    expect(screen.getByTestId("week-plan-card")).toBeInTheDocument();
    expect(screen.getByText(/PPL split/)).toBeInTheDocument();
  });

  it("returns null for unknown state", () => {
    const { container } = render(
      <ToolCallIndicator toolName="search_exercises" state="unknown-state" />,
    );

    expect(container.firstChild).toBeNull();
  });
});
