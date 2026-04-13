import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SyncStatusBanner } from "./SyncStatusBanner";

const mockUseQuery = vi.fn();

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("convex/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: true }),
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    users: {
      getMe: "users:getMe",
    },
  },
}));

describe("SyncStatusBanner", () => {
  afterEach(() => {
    mockUseQuery.mockReset();
  });

  it("renders syncing banner when syncStatus is syncing", () => {
    mockUseQuery.mockReturnValue({ syncStatus: "syncing", tonalTokenExpired: false });

    render(<SyncStatusBanner />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText(/syncing your tonal history/i)).toBeInTheDocument();
  });

  it("renders failed banner with Settings link when syncStatus is failed", () => {
    mockUseQuery.mockReturnValue({ syncStatus: "failed", tonalTokenExpired: false });

    render(<SyncStatusBanner />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /settings/i });
    expect(link).toHaveAttribute("href", "/settings");
  });

  it("dismisses failed banner when dismiss button is clicked", () => {
    mockUseQuery.mockReturnValue({ syncStatus: "failed", tonalTokenExpired: false });

    const { container } = render(<SyncStatusBanner />);

    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));

    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when syncStatus is complete", () => {
    mockUseQuery.mockReturnValue({ syncStatus: "complete", tonalTokenExpired: false });

    const { container } = render(<SyncStatusBanner />);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when syncStatus is undefined", () => {
    mockUseQuery.mockReturnValue({ syncStatus: undefined, tonalTokenExpired: false });

    const { container } = render(<SyncStatusBanner />);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when user data is not loaded", () => {
    mockUseQuery.mockReturnValue(null);

    const { container } = render(<SyncStatusBanner />);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when token is expired (token banner takes priority)", () => {
    mockUseQuery.mockReturnValue({ syncStatus: "syncing", tonalTokenExpired: true });

    const { container } = render(<SyncStatusBanner />);

    expect(container).toBeEmptyDOMElement();
  });

  it("re-shows failed banner after status transitions through non-failed state", () => {
    mockUseQuery.mockReturnValue({ syncStatus: "failed", tonalTokenExpired: false });

    const { rerender } = render(<SyncStatusBanner />);
    expect(screen.getByRole("alert")).toBeInTheDocument();

    // Dismiss
    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));

    // Transition to syncing (retry triggered)
    mockUseQuery.mockReturnValue({ syncStatus: "syncing", tonalTokenExpired: false });
    rerender(<SyncStatusBanner />);
    expect(screen.getByRole("status")).toBeInTheDocument();

    // Fail again
    mockUseQuery.mockReturnValue({ syncStatus: "failed", tonalTokenExpired: false });
    rerender(<SyncStatusBanner />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
