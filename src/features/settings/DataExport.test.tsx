import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DataExport } from "./DataExport";

const mockExportData = vi.fn();

vi.mock("convex/react", () => ({
  useAction: () => mockExportData,
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    dataExport: {
      exportData: "dataExport:exportData",
    },
  },
}));

const FAKE_EXPORT_DATA = {
  exportedAt: "2024-01-15T00:00:00Z",
  user: { email: "test@example.com", name: "Test" },
  profile: null,
  workoutPlans: [],
  weekPlans: [],
  checkIns: [],
  completedWorkouts: [
    {
      date: "2024-01-15",
      title: "Upper Body",
      targetArea: "Upper",
      totalDuration: 2100,
      totalVolume: 12500,
      totalWork: 45000,
      workoutType: "strength",
    },
  ],
  exercisePerformance: [
    {
      date: "2024-01-15",
      exerciseName: "Bench Press",
      movementId: "mv-1",
      sets: 3,
      totalReps: 24,
      avgWeightLbs: 135,
      totalVolume: 3240,
    },
  ],
  strengthScoreSnapshots: [{ date: "2024-01-15", overall: 500, upper: 450, lower: 520, core: 480 }],
  currentStrengthScores: [{ bodyRegion: "Upper", score: 450 }],
  muscleReadiness: {
    chest: 80,
    shoulders: 75,
    back: 90,
    triceps: 85,
    biceps: 70,
    abs: 65,
    obliques: 60,
    quads: 95,
    glutes: 88,
    hamstrings: 72,
    calves: 78,
  },
  externalActivities: [
    {
      workoutType: "Running",
      beginTime: "2024-01-14T08:00:00Z",
      totalDuration: 1800,
      activeCalories: 350,
      totalCalories: 400,
      averageHeartRate: 145,
      source: "Apple Watch",
      distance: 5000,
    },
  ],
};

function setupDomMocks() {
  URL.createObjectURL = vi.fn(() => "blob:fake-url");
  URL.revokeObjectURL = vi.fn();
  // Must be called AFTER render() to avoid blocking React's DOM insertion
  vi.spyOn(document.body, "appendChild").mockImplementation((node) => {
    (node as HTMLAnchorElement).click = vi.fn();
    return node;
  });
  vi.spyOn(document.body, "removeChild").mockImplementation((node) => node);
}

describe("DataExport", () => {
  beforeEach(() => {
    mockExportData.mockReset();
    vi.restoreAllMocks();
  });

  it("renders the export button and format selector", () => {
    render(<DataExport />);

    expect(screen.getByRole("button", { name: /export/i })).toBeInTheDocument();
    expect(screen.getByText("Export My Data")).toBeInTheDocument();
    expect(screen.getByLabelText("Export format")).toBeInTheDocument();
  });

  it("button is enabled in idle state", () => {
    render(<DataExport />);

    expect(screen.getByRole("button", { name: /export/i })).not.toBeDisabled();
  });

  it("disables the button while export is loading", async () => {
    mockExportData.mockImplementation(() => new Promise(() => {}));
    render(<DataExport />);

    fireEvent.click(screen.getByRole("button", { name: /export/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /export/i })).toBeDisabled();
    });
  });

  it("creates a JSON download on default format", async () => {
    mockExportData.mockResolvedValueOnce(FAKE_EXPORT_DATA);
    render(<DataExport />);
    setupDomMocks();

    fireEvent.click(screen.getByRole("button", { name: /export/i }));

    await waitFor(() => {
      expect(URL.createObjectURL).toHaveBeenCalled();
    });

    const blobArg = (URL.createObjectURL as ReturnType<typeof vi.fn>).mock.calls[0][0] as Blob;
    expect(blobArg.type).toBe("application/json");
  });

  it("creates a CSV download for workout history format", async () => {
    mockExportData.mockResolvedValueOnce(FAKE_EXPORT_DATA);
    render(<DataExport />);
    setupDomMocks();

    fireEvent.change(screen.getByLabelText("Export format"), {
      target: { value: "csv-workouts" },
    });
    fireEvent.click(screen.getByRole("button", { name: /export/i }));

    await waitFor(() => {
      expect(URL.createObjectURL).toHaveBeenCalled();
    });

    const blobArg = (URL.createObjectURL as ReturnType<typeof vi.fn>).mock.calls[0][0] as Blob;
    expect(blobArg.type).toBe("text/csv");
  });

  it("creates a CSV download for exercise details format", async () => {
    mockExportData.mockResolvedValueOnce(FAKE_EXPORT_DATA);
    render(<DataExport />);
    setupDomMocks();

    fireEvent.change(screen.getByLabelText("Export format"), {
      target: { value: "csv-exercises" },
    });
    fireEvent.click(screen.getByRole("button", { name: /export/i }));

    await waitFor(() => {
      expect(URL.createObjectURL).toHaveBeenCalled();
    });

    const blobArg = (URL.createObjectURL as ReturnType<typeof vi.fn>).mock.calls[0][0] as Blob;
    expect(blobArg.type).toBe("text/csv");
  });

  it("creates a CSV download for strength scores format", async () => {
    mockExportData.mockResolvedValueOnce(FAKE_EXPORT_DATA);
    render(<DataExport />);
    setupDomMocks();

    fireEvent.change(screen.getByLabelText("Export format"), {
      target: { value: "csv-strength" },
    });
    fireEvent.click(screen.getByRole("button", { name: /export/i }));

    await waitFor(() => {
      expect(URL.createObjectURL).toHaveBeenCalled();
    });

    const blobArg = (URL.createObjectURL as ReturnType<typeof vi.fn>).mock.calls[0][0] as Blob;
    expect(blobArg.type).toBe("text/csv");
  });

  it("creates a CSV download for external activities format", async () => {
    mockExportData.mockResolvedValueOnce(FAKE_EXPORT_DATA);
    render(<DataExport />);
    setupDomMocks();

    fireEvent.change(screen.getByLabelText("Export format"), {
      target: { value: "csv-activities" },
    });
    fireEvent.click(screen.getByRole("button", { name: /export/i }));

    await waitFor(() => {
      expect(URL.createObjectURL).toHaveBeenCalled();
    });

    const blobArg = (URL.createObjectURL as ReturnType<typeof vi.fn>).mock.calls[0][0] as Blob;
    expect(blobArg.type).toBe("text/csv");
  });

  it("returns button to enabled state after successful export", async () => {
    mockExportData.mockResolvedValueOnce(FAKE_EXPORT_DATA);
    render(<DataExport />);
    setupDomMocks();

    fireEvent.click(screen.getByRole("button", { name: /export/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /export/i })).not.toBeDisabled();
    });
  });

  it("shows error message when export throws", async () => {
    mockExportData.mockRejectedValueOnce(new Error("Export failed due to server error."));
    render(<DataExport />);

    fireEvent.click(screen.getByRole("button", { name: /export/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Export failed due to server error.",
    );
  });

  it("shows generic error when thrown value is not an Error", async () => {
    mockExportData.mockRejectedValueOnce("unknown");
    render(<DataExport />);

    fireEvent.click(screen.getByRole("button", { name: /export/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Export failed.");
  });
});
