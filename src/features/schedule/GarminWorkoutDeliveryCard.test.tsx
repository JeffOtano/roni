import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GarminWorkoutDeliveryCard } from "./GarminWorkoutDeliveryCard";
import type { Id } from "../../../convex/_generated/dataModel";

const mockSendToGarmin = vi.fn();
let mockConnection: unknown;
let mockDelivery: unknown;

vi.mock("convex/react", () => ({
  useAction: () => mockSendToGarmin,
  useQuery: (ref: string) => {
    if (ref === "garmin:connections:getMyGarminStatus") return mockConnection;
    if (ref === "garmin:workoutDelivery:getMyWorkoutDelivery") return mockDelivery;
    throw new Error(`Unexpected query ${ref}`);
  },
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    garmin: {
      connections: {
        getMyGarminStatus: "garmin:connections:getMyGarminStatus",
      },
      workoutDelivery: {
        getMyWorkoutDelivery: "garmin:workoutDelivery:getMyWorkoutDelivery",
        sendWorkoutPlanToGarmin: "garmin:workoutDelivery:sendWorkoutPlanToGarmin",
      },
    },
  },
}));

const workoutPlanId = "plan-1" as Id<"workoutPlans">;

function renderCard(isPast = false) {
  return render(
    <GarminWorkoutDeliveryCard
      workoutPlanId={workoutPlanId}
      scheduledDate="2026-05-05"
      isPast={isPast}
    />,
  );
}

describe("GarminWorkoutDeliveryCard", () => {
  beforeEach(() => {
    mockSendToGarmin.mockReset();
    mockConnection = {
      state: "active",
      garminUserId: "garmin-user-1",
      connectedAt: Date.UTC(2026, 4, 1),
      permissions: ["WORKOUT_IMPORT", "ACTIVITY_EXPORT"],
    };
    mockDelivery = { status: "none" };
  });

  it("sends the scheduled workout to Garmin", async () => {
    mockSendToGarmin.mockResolvedValueOnce({
      success: true,
      delivery: {
        status: "sent",
        scheduledDate: "2026-05-05",
        garminWorkoutId: "123",
        updatedAt: Date.UTC(2026, 4, 5),
      },
    });
    renderCard();

    fireEvent.click(screen.getByRole("button", { name: /send to garmin/i }));

    await waitFor(() => {
      expect(mockSendToGarmin).toHaveBeenCalledWith({
        workoutPlanId,
        scheduledDate: "2026-05-05",
      });
    });
  });

  it("shows sent state without allowing duplicate sends", () => {
    mockDelivery = {
      status: "sent",
      scheduledDate: "2026-05-05",
      garminWorkoutId: "123",
      updatedAt: Date.UTC(2026, 4, 5),
      sentAt: Date.UTC(2026, 4, 5),
    };

    renderCard();

    expect(screen.getByText(/sent on may 5/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sent/i })).toBeDisabled();
  });

  it("links to settings when Garmin is not connected", () => {
    mockConnection = { state: "none" };

    renderCard();

    expect(screen.getByRole("button", { name: /connect garmin/i })).toHaveAttribute(
      "href",
      "/settings",
    );
  });

  it("blocks sends when workout import permission is missing", () => {
    mockConnection = {
      state: "active",
      garminUserId: "garmin-user-1",
      connectedAt: Date.UTC(2026, 4, 1),
      permissions: ["ACTIVITY_EXPORT"],
    };

    renderCard();

    expect(screen.getByRole("button", { name: /missing permission/i })).toBeDisabled();
  });

  it("shows failed action errors", async () => {
    mockSendToGarmin.mockResolvedValueOnce({
      success: false,
      error: "Garmin rate-limited workout.",
    });
    renderCard();

    fireEvent.click(screen.getByRole("button", { name: /send to garmin/i }));

    expect(await screen.findByText("Garmin rate-limited workout.")).toBeInTheDocument();
  });

  it("disables sends for past schedule dates", () => {
    renderCard(true);

    expect(screen.getByRole("button", { name: /past date/i })).toBeDisabled();
  });

  it("uses a neutral loading action while queries are unresolved", () => {
    mockConnection = undefined;
    mockDelivery = undefined;

    renderCard();

    expect(screen.getByRole("button", { name: /checking/i })).toBeDisabled();
  });
});
