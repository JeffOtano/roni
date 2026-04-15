import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { MuscleReadiness } from "../../../convex/tonal/types";
import { MuscleReadinessMap } from "./MuscleReadinessMap";

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("lucide-react", () => ({
  ArrowRight: (props: Record<string, unknown>) => <span data-icon="ArrowRight" {...props} />,
}));

const BASE_READINESS: MuscleReadiness = {
  Chest: 80,
  Shoulders: 70,
  Back: 65,
  Triceps: 55,
  Biceps: 50,
  Abs: 45,
  Obliques: 40,
  Quads: 35,
  Glutes: 25,
  Hamstrings: 15,
  Calves: 10,
};

describe("MuscleReadinessMap", () => {
  it("renders all 11 muscle groups", () => {
    render(<MuscleReadinessMap readiness={BASE_READINESS} />);

    const muscleNames = [
      "Chest",
      "Shoulders",
      "Back",
      "Triceps",
      "Biceps",
      "Abs",
      "Obliques",
      "Quads",
      "Glutes",
      "Hamstrings",
      "Calves",
    ];
    for (const muscle of muscleNames) {
      expect(screen.getByText(muscle)).toBeInTheDocument();
    }
  });

  it("sorts muscles by readiness descending so the highest value is first in the DOM", () => {
    // Chest is 80 (highest), Calves is 10 (lowest)
    render(<MuscleReadinessMap readiness={BASE_READINESS} />);

    const muscleLabels = screen.getAllByText(/^(Chest|Calves)$/);
    // Chest should appear before Calves in document order
    const chestIdx = muscleLabels.findIndex((el) => el.textContent === "Chest");
    const calvesIdx = muscleLabels.findIndex((el) => el.textContent === "Calves");
    expect(chestIdx).toBeLessThan(calvesIdx);
  });

  it("shows the numeric readiness value for each muscle", () => {
    render(<MuscleReadinessMap readiness={BASE_READINESS} />);

    expect(screen.getByText("80")).toBeInTheDocument();
    expect(screen.getByText("25")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
  });

  it("shows 'Ready' label for muscles with readiness > 60", () => {
    const readiness: MuscleReadiness = { ...BASE_READINESS, Chest: 80 };

    render(<MuscleReadinessMap readiness={readiness} />);

    const readyLabels = screen.getAllByText("Ready");
    expect(readyLabels.length).toBeGreaterThan(0);
  });

  it("shows 'Recovering' label for muscles with readiness between 31 and 60", () => {
    const readiness: MuscleReadiness = { ...BASE_READINESS, Triceps: 55 };

    render(<MuscleReadinessMap readiness={readiness} />);

    const recoveringLabels = screen.getAllByText("Recovering");
    expect(recoveringLabels.length).toBeGreaterThan(0);
  });

  it("shows 'Fatigued' label for muscles with readiness <= 30", () => {
    const readiness: MuscleReadiness = { ...BASE_READINESS, Glutes: 25 };

    render(<MuscleReadinessMap readiness={readiness} />);

    const fatiguedLabels = screen.getAllByText("Fatigued");
    expect(fatiguedLabels.length).toBeGreaterThan(0);
  });

  it("renders links to the exercises page with the muscle group as a query param", () => {
    render(<MuscleReadinessMap readiness={BASE_READINESS} />);

    const chestLink = screen.getByRole("link", { name: /chest/i });
    expect(chestLink).toHaveAttribute("href", "/exercises?muscleGroup=Chest");
  });

  it("shows a fresh muscle coach prompt link when a muscle exceeds 80% readiness", () => {
    const readiness: MuscleReadiness = { ...BASE_READINESS, Chest: 85 };

    render(<MuscleReadinessMap readiness={readiness} />);

    expect(screen.getByText(/chest is fresh/i)).toBeInTheDocument();
  });

  it("does not show fresh muscle coach link when no muscle is above 80%", () => {
    const readiness: MuscleReadiness = {
      ...BASE_READINESS,
      Chest: 79,
      Shoulders: 70,
      Back: 65,
      Triceps: 55,
      Biceps: 50,
      Abs: 45,
      Obliques: 40,
      Quads: 35,
      Glutes: 25,
      Hamstrings: 15,
      Calves: 10,
    };

    render(<MuscleReadinessMap readiness={readiness} />);

    expect(screen.queryByText(/is fresh/i)).toBeNull();
  });

  it("fresh muscle prompt link does not contain HTML entities in the href", () => {
    const readiness: MuscleReadiness = { ...BASE_READINESS, Chest: 85 };

    render(<MuscleReadinessMap readiness={readiness} />);

    const freshLink = screen.getByRole("link", { name: /fresh/i });
    const href = freshLink.getAttribute("href") ?? "";

    expect(decodeURIComponent(href)).not.toContain("&nbsp;");
  });

  it("shows a rest day tips link when a muscle is fatigued (<= 30%)", () => {
    // Override all originally-fatigued muscles above 30 so Hamstrings is the first fatigued entry
    const readiness: MuscleReadiness = {
      ...BASE_READINESS,
      Glutes: 50,
      Calves: 40,
      Hamstrings: 15,
    };

    render(<MuscleReadinessMap readiness={readiness} />);

    expect(screen.getByText(/rest day tips for hamstrings/i)).toBeInTheDocument();
  });
});
