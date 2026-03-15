import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DateDivider } from "./DateDivider";

function daysAgo(days: number): number {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.getTime();
}

describe("DateDivider", () => {
  it("renders 'Today' for today's date", () => {
    render(<DateDivider timestamp={daysAgo(0)} />);

    expect(screen.getByText("Today")).toBeInTheDocument();
  });

  it("renders 'Yesterday' for yesterday's date", () => {
    render(<DateDivider timestamp={daysAgo(1)} />);

    expect(screen.getByText("Yesterday")).toBeInTheDocument();
  });

  it("renders a formatted date for older dates", () => {
    // Use a fixed past date so the label is deterministic
    const past = new Date(2024, 0, 5).getTime(); // January 5, 2024

    render(<DateDivider timestamp={past} />);

    const label = screen.getByText(/january 5/i);
    expect(label).toBeInTheDocument();
  });

  it("renders the label text inside a span", () => {
    render(<DateDivider timestamp={daysAgo(0)} />);

    const span = screen.getByText("Today");
    expect(span.tagName.toLowerCase()).toBe("span");
  });
});
