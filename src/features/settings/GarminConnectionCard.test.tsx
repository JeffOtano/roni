import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GarminConnectionCard } from "./GarminConnectionCard";

const mockStartOAuth = vi.fn();
const mockDisconnect = vi.fn();
const mockRequestBackfill = vi.fn();
let mockStatus: unknown;

vi.mock("convex/react", () => ({
  useQuery: () => mockStatus,
  useAction: (ref: string) => {
    if (ref === "garmin:oauthFlow:startGarminOAuth") return mockStartOAuth;
    if (ref === "garmin:registration:disconnectMyGarmin") return mockDisconnect;
    if (ref === "garmin:backfill:requestGarminBackfill") return mockRequestBackfill;
    throw new Error(`Unexpected action ${ref}`);
  },
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    garmin: {
      backfill: {
        requestGarminBackfill: "garmin:backfill:requestGarminBackfill",
      },
      connections: {
        getMyGarminStatus: "garmin:connections:getMyGarminStatus",
      },
      oauthFlow: {
        startGarminOAuth: "garmin:oauthFlow:startGarminOAuth",
      },
      registration: {
        disconnectMyGarmin: "garmin:registration:disconnectMyGarmin",
      },
    },
  },
}));

describe("GarminConnectionCard", () => {
  beforeEach(() => {
    mockStartOAuth.mockReset();
    mockDisconnect.mockReset();
    mockRequestBackfill.mockReset();
    mockStatus = {
      state: "active",
      connectedAt: Date.UTC(2026, 3, 21),
      permissions: ["ACTIVITY_EXPORT", "HEALTH_EXPORT", "MCT_EXPORT"],
    };
  });

  it("renders connected controls with readable permission labels", () => {
    render(<GarminConnectionCard />);

    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(screen.getByText("Activity Export")).toBeInTheDocument();
    expect(screen.getByText("Health Export")).toBeInTheDocument();
    expect(screen.getByText("MCT Export")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sync last 30d/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /disconnect/i })).toBeEnabled();
  });

  it("shows a warning when detailed Garmin backfill data is rate-limited", async () => {
    mockRequestBackfill.mockResolvedValueOnce({
      success: true,
      accepted: ["activities", "dailies", "sleeps"],
      rateLimited: [{ summaryType: "hrv", retryAfterSeconds: 75 }],
      rejected: [],
    });

    render(<GarminConnectionCard />);

    fireEvent.click(screen.getByRole("button", { name: /sync last 30d/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /syncing/i })).toBeDisabled();
    });
    expect(await screen.findByText(/Garmin rate-limited HRV/i)).toBeInTheDocument();
    expect(mockRequestBackfill).toHaveBeenCalledWith({ days: 30 });
  });

  it("renders a disconnected state with a readable reason", () => {
    mockStatus = {
      state: "disconnected",
      disconnectedAt: Date.UTC(2026, 3, 22),
      reason: "permission_revoked",
    };

    render(<GarminConnectionCard />);

    expect(screen.getByText("Disconnected")).toBeInTheDocument();
    expect(screen.getByText(/Permission Revoked/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /connect garmin/i })).toBeEnabled();
  });

  it("uses a compact loading state while status is unresolved", () => {
    mockStatus = undefined;

    render(<GarminConnectionCard />);

    expect(screen.getByText("Loading Garmin status...")).toBeInTheDocument();
  });
});
