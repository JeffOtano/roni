import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { StaleCta } from "./StaleCta";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function daysAgoDate(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

describe("StaleCta", () => {
  it("returns null when data array is empty", () => {
    const { container } = render(<StaleCta data={[]} />);

    expect(container.firstChild).toBeNull();
  });

  it("returns null when no entry has a lastTrainedDate", () => {
    const data = [{ targetArea: "Full Body", count: 3 }];

    const { container } = render(<StaleCta data={data} />);

    expect(container.firstChild).toBeNull();
  });

  it("returns null when all entries were trained within 7 days", () => {
    const data = [
      { targetArea: "Upper Body", count: 2, lastTrainedDate: daysAgoDate(3) },
      { targetArea: "Lower Body", count: 1, lastTrainedDate: daysAgoDate(6) },
    ];

    const { container } = render(<StaleCta data={data} />);

    expect(container.firstChild).toBeNull();
  });

  it("shows message when a muscle group was last trained more than 7 days ago", () => {
    const data = [{ targetArea: "Upper Body", count: 2, lastTrainedDate: daysAgoDate(8) }];

    render(<StaleCta data={data} />);

    expect(screen.getByText(/upper body/i)).toBeInTheDocument();
    expect(screen.getByText(/8 days/)).toBeInTheDocument();
  });

  it("renders a link to chat with a prompt when stale data is found", () => {
    const data = [{ targetArea: "Core", count: 1, lastTrainedDate: daysAgoDate(10) }];

    render(<StaleCta data={data} />);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", expect.stringContaining("/chat?prompt="));
    expect(link).toHaveAttribute("href", expect.stringContaining("core"));
    expect(link).toHaveAttribute("href", expect.stringContaining("10%20days"));
  });

  it("picks the first stale entry when multiple entries are stale", () => {
    const data = [
      { targetArea: "Legs", count: 1, lastTrainedDate: daysAgoDate(14) },
      { targetArea: "Arms", count: 1, lastTrainedDate: daysAgoDate(9) },
    ];

    render(<StaleCta data={data} />);

    // Only one CTA should render
    expect(screen.getAllByRole("link")).toHaveLength(1);
    // The first stale entry ("Legs") should be shown
    expect(screen.getByText(/legs/i)).toBeInTheDocument();
  });

  it("does not show CTA for an entry trained exactly at the 7-day boundary", () => {
    // Freeze time so test and component see the same Date.now()
    const frozenNow = Date.now();
    vi.useFakeTimers({ now: frozenNow });

    const sevenDaysAgo = new Date(frozenNow - SEVEN_DAYS_MS).toISOString();
    const data = [{ targetArea: "Full Body", count: 1, lastTrainedDate: sevenDaysAgo }];

    const { container } = render(<StaleCta data={data} />);

    expect(container.firstChild).toBeNull();

    vi.useRealTimers();
  });
});
