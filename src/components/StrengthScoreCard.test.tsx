import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { StrengthDistribution, StrengthScore } from "../../convex/tonal/types";
import { StrengthScoreCard } from "./StrengthScoreCard";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// ProgressRing renders the score as visible text; no need to mock it.

function makeScore(overrides: Partial<StrengthScore> = {}): StrengthScore {
  return {
    id: "score-1",
    userId: "user-1",
    strengthBodyRegion: "overall",
    bodyRegionDisplay: "Overall",
    score: 300,
    current: true,
    ...overrides,
  };
}

function makeDistribution(overrides: Partial<StrengthDistribution> = {}): StrengthDistribution {
  return {
    userId: "user-1",
    overallScore: 300,
    percentile: 75,
    distributionPoints: [],
    ...overrides,
  };
}

describe("StrengthScoreCard", () => {
  it("renders the percentile badge with the correct label", () => {
    const distribution = makeDistribution({ percentile: 75 });

    render(<StrengthScoreCard scores={[]} distribution={distribution} />);

    // Top X% = 100 - percentile
    expect(screen.getByText("Top 25%")).toBeInTheDocument();
  });

  it("renders the Overall progress ring using the distribution overallScore", () => {
    const distribution = makeDistribution({ overallScore: 287 });

    render(<StrengthScoreCard scores={[]} distribution={distribution} />);

    expect(screen.getByText("287")).toBeInTheDocument();
    expect(screen.getByText("Overall")).toBeInTheDocument();
  });

  it("renders 4 progress rings: Overall, Upper, Lower, Core", () => {
    const scores = [
      makeScore({ strengthBodyRegion: "upper_body", score: 320 }),
      makeScore({ id: "s2", strengthBodyRegion: "lower_body", score: 280 }),
      makeScore({ id: "s3", strengthBodyRegion: "core", score: 260 }),
    ];
    const distribution = makeDistribution({ overallScore: 300 });

    render(<StrengthScoreCard scores={scores} distribution={distribution} />);

    expect(screen.getByText("Overall")).toBeInTheDocument();
    expect(screen.getByText("Upper")).toBeInTheDocument();
    expect(screen.getByText("Lower")).toBeInTheDocument();
    expect(screen.getByText("Core")).toBeInTheDocument();
  });

  it("shows the 'View strength history' link pointing to /strength", () => {
    render(<StrengthScoreCard scores={[]} distribution={makeDistribution()} />);

    const link = screen.getByRole("link", { name: /view strength history/i });
    expect(link).toHaveAttribute("href", "/strength");
  });

  it("shows the 'Ask coach about trends' link pointing to /chat", () => {
    render(<StrengthScoreCard scores={[]} distribution={makeDistribution()} />);

    const link = screen.getByRole("link", { name: /ask coach about trends/i });
    expect(link).toHaveAttribute("href", expect.stringContaining("/chat?prompt="));
  });

  it("matches score using fuzzy logic when strengthBodyRegion uses underscore variant (upper_body)", () => {
    const scores = [makeScore({ strengthBodyRegion: "upper_body", score: 350 })];

    render(<StrengthScoreCard scores={scores} distribution={makeDistribution()} />);

    // The "Upper" ring should show 350, not 0
    expect(screen.getByText("350")).toBeInTheDocument();
  });

  it("falls back to 0 for a region with no matching score", () => {
    // No core score provided
    const scores = [makeScore({ strengthBodyRegion: "upper_body", score: 320 })];

    render(
      <StrengthScoreCard scores={scores} distribution={makeDistribution({ overallScore: 300 })} />,
    );

    // Core score should be 0
    const zeros = screen.getAllByText("0");
    expect(zeros.length).toBeGreaterThanOrEqual(1);
  });

  it("matches using bodyRegionDisplay when strengthBodyRegion is empty", () => {
    const scores = [
      makeScore({ strengthBodyRegion: "", bodyRegionDisplay: "Upper Body", score: 410 }),
    ];

    render(<StrengthScoreCard scores={scores} distribution={makeDistribution()} />);

    expect(screen.getByText("410")).toBeInTheDocument();
  });
});
