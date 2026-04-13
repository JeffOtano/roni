import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ActionConfirmationBanner } from "./ActionConfirmationBanner";

describe("ActionConfirmationBanner", () => {
  it("renders success variant with checkmark and message", () => {
    render(<ActionConfirmationBanner variant="success" message="5 workouts pushed to Tonal" />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("5 workouts pushed to Tonal")).toBeInTheDocument();
    expect(
      screen.getByRole("status").querySelector("[data-testid='banner-icon-success']"),
    ).toBeInTheDocument();
  });

  it("renders error variant with alert icon and message", () => {
    render(<ActionConfirmationBanner variant="error" message="3 pushed, 2 failed" />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("3 pushed, 2 failed")).toBeInTheDocument();
    expect(
      screen.getByRole("status").querySelector("[data-testid='banner-icon-error']"),
    ).toBeInTheDocument();
  });

  it("applies green styling for success variant", () => {
    render(<ActionConfirmationBanner variant="success" message="Done" />);

    const banner = screen.getByRole("status");
    expect(banner.className).toContain("border-green");
  });

  it("applies red styling for error variant", () => {
    render(<ActionConfirmationBanner variant="error" message="Failed" />);

    const banner = screen.getByRole("status");
    expect(banner.className).toContain("border-red");
  });
});
