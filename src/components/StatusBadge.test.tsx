import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusBadge } from "./StatusBadge";

describe("StatusBadge", () => {
  it("renders 'Preview' for draft status", () => {
    render(<StatusBadge status="draft" />);

    expect(screen.getByText("Preview")).toBeInTheDocument();
  });

  it("renders 'Pushed to Tonal' for pushed status", () => {
    render(<StatusBadge status="pushed" />);

    expect(screen.getByText("Pushed to Tonal")).toBeInTheDocument();
  });

  it("renders 'Completed' for completed status", () => {
    render(<StatusBadge status="completed" />);

    expect(screen.getByText("Completed")).toBeInTheDocument();
  });

  it("renders 'Removed' for deleted status", () => {
    render(<StatusBadge status="deleted" />);

    expect(screen.getByText("Removed")).toBeInTheDocument();
  });

  it("returns null for unknown status", () => {
    const { container } = render(<StatusBadge status="unknown" />);

    expect(container.firstChild).toBeNull();
  });
});
