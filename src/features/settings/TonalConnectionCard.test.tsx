import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TonalConnectionCard } from "./TonalConnectionCard";

const mockRefreshTonalData = vi.fn();

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("convex/react", () => ({
  useAction: () => mockRefreshTonalData,
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    tonal: {
      refreshPublic: {
        refreshTonalData: "tonal:refreshPublic:refreshTonalData",
      },
    },
  },
}));

vi.mock("@/components/ReconnectModal", () => ({
  ReconnectModal: ({
    open,
    tonalEmail,
  }: {
    open: boolean;
    tonalEmail: string;
    onDismiss: () => void;
  }) => (open ? <div data-testid="reconnect-modal">{tonalEmail}</div> : null),
}));

describe("TonalConnectionCard", () => {
  beforeEach(() => {
    mockRefreshTonalData.mockReset();
  });

  it("renders a connect link when Tonal is not connected", () => {
    render(<TonalConnectionCard connection={{ state: "disconnected" }} />);

    expect(screen.getByText("Not Connected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /connect/i })).toHaveAttribute(
      "href",
      "/connect-tonal",
    );
    expect(screen.queryByRole("button", { name: /refresh data/i })).toBeNull();
  });

  it("renders connected controls and opens reconnect modal", () => {
    render(
      <TonalConnectionCard
        connection={{
          state: "connected",
          tonalName: "Ada Lovelace",
          tonalEmail: "ada@example.com",
          tonalTokenExpired: false,
        }}
      />,
    );

    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /refresh data/i })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: /reconnect/i }));

    expect(screen.getByTestId("reconnect-modal")).toHaveTextContent("ada@example.com");
  });

  it("disables refresh and explains reconnect when the Tonal session is expired", () => {
    render(
      <TonalConnectionCard
        connection={{
          state: "connected",
          tonalName: "Ada Lovelace",
          tonalEmail: "ada@example.com",
          tonalTokenExpired: true,
        }}
      />,
    );

    expect(screen.getByRole("button", { name: /refresh data/i })).toBeDisabled();
    expect(screen.getByText(/your current tonal session has expired/i)).toBeInTheDocument();
  });

  it("shows a success message after syncing new workouts", async () => {
    mockRefreshTonalData.mockResolvedValueOnce({
      refreshedAt: 1000,
      newWorkouts: 2,
      totalActivities: 8,
    });

    render(
      <TonalConnectionCard
        connection={{ state: "connectedWithoutEmail", tonalTokenExpired: false }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /refresh data/i }));

    expect(
      await screen.findByText("Tonal data refreshed. Synced 2 new workouts."),
    ).toBeInTheDocument();
    expect(mockRefreshTonalData).toHaveBeenCalledWith({});
  });

  it("shows a warning when Tonal still returns no workout history", async () => {
    mockRefreshTonalData.mockResolvedValueOnce({
      refreshedAt: 1000,
      newWorkouts: 0,
      totalActivities: 0,
    });

    render(
      <TonalConnectionCard
        connection={{ state: "connectedWithoutEmail", tonalTokenExpired: false }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /refresh data/i }));

    expect(
      await screen.findByText("Refresh finished, but Tonal still returned no workout history."),
    ).toBeInTheDocument();
  });

  it("maps session-expired refresh results to reconnect guidance", async () => {
    mockRefreshTonalData.mockResolvedValueOnce({ error: "session_expired" });

    render(
      <TonalConnectionCard
        connection={{ state: "connectedWithoutEmail", tonalTokenExpired: false }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /refresh data/i }));

    expect(
      await screen.findByText("Your Tonal session expired. Reconnect to refresh data."),
    ).toBeInTheDocument();
  });

  it("maps not-connected refresh results to connect guidance", async () => {
    mockRefreshTonalData.mockResolvedValueOnce({ error: "not_connected" });

    render(
      <TonalConnectionCard
        connection={{ state: "connectedWithoutEmail", tonalTokenExpired: false }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /refresh data/i }));

    expect(
      await screen.findByText("Connect Tonal before trying to refresh your data."),
    ).toBeInTheDocument();
  });

  it("maps rate-limit refresh results to a retry-later message", async () => {
    mockRefreshTonalData.mockResolvedValueOnce({ error: "rate_limited" });

    render(
      <TonalConnectionCard
        connection={{ state: "connectedWithoutEmail", tonalTokenExpired: false }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /refresh data/i }));

    expect(
      await screen.findByText("Refresh is rate-limited. Try again in 1 minute."),
    ).toBeInTheDocument();
  });

  it("maps thrown session-expired errors to reconnect guidance", async () => {
    mockRefreshTonalData.mockRejectedValueOnce(
      new Error("Tonal session expired — please reconnect"),
    );

    render(
      <TonalConnectionCard
        connection={{ state: "connectedWithoutEmail", tonalTokenExpired: false }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /refresh data/i }));

    expect(
      await screen.findByText("Your Tonal session expired. Reconnect to refresh data."),
    ).toBeInTheDocument();
  });

  it("shows a loading state while a refresh is in flight", async () => {
    mockRefreshTonalData.mockImplementationOnce(() => new Promise(() => {}));

    render(
      <TonalConnectionCard
        connection={{ state: "connectedWithoutEmail", tonalTokenExpired: false }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /refresh data/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /refreshing/i })).toBeDisabled();
    });
  });

  it("falls back to a reconnect link when the connection is missing a Tonal email", () => {
    render(
      <TonalConnectionCard
        connection={{
          state: "connectedWithoutEmail",
          tonalName: "Ada Lovelace",
          tonalTokenExpired: false,
        }}
      />,
    );

    expect(screen.getByRole("button", { name: /reconnect/i })).toHaveAttribute(
      "href",
      "/connect-tonal",
    );
    expect(screen.queryByTestId("reconnect-modal")).toBeNull();
  });
});
