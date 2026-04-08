import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useQuery } from "convex/react";
import { CheckInBell } from "./CheckInBell";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    checkIns: {
      listUnread: "checkIns/listUnread",
    },
  },
}));

describe("CheckInBell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing while unread check-ins are loading", () => {
    vi.mocked(useQuery).mockReturnValue(undefined);

    const { container } = render(<CheckInBell />);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when there are no unread check-ins", () => {
    vi.mocked(useQuery).mockReturnValue([]);

    const { container } = render(<CheckInBell />);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders a capped badge count for unread check-ins", () => {
    vi.mocked(useQuery).mockReturnValue(new Array(12).fill(null));

    render(<CheckInBell />);

    expect(screen.getByRole("link", { name: "12 unread check-ins" })).toHaveAttribute(
      "href",
      "/check-ins",
    );
    expect(screen.getByText("9+")).toBeInTheDocument();
  });
});
