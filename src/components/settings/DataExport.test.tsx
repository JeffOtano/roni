import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DataExport } from "./DataExport";

const mockExportData = vi.fn();

vi.mock("convex/react", () => ({
  useAction: () => mockExportData,
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    account: {
      exportData: "account:exportData",
    },
  },
}));

describe("DataExport", () => {
  beforeEach(() => {
    mockExportData.mockReset();

    // Reset DOM click spy
    vi.restoreAllMocks();
  });

  it("renders the export button", () => {
    render(<DataExport />);

    expect(screen.getByRole("button", { name: /export/i })).toBeInTheDocument();
    expect(screen.getByText("Export My Data")).toBeInTheDocument();
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

  it("creates a download link and triggers click on success", async () => {
    const fakeData = { workouts: [] };
    mockExportData.mockResolvedValueOnce(fakeData);

    const createObjectURL = vi.fn(() => "blob:fake-url");
    const revokeObjectURL = vi.fn();
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;

    render(<DataExport />);

    const clickSpy = vi.fn();
    const appendSpy = vi.spyOn(document.body, "appendChild").mockImplementation((node) => {
      (node as HTMLAnchorElement).click = clickSpy;
      return node;
    });
    const removeSpy = vi.spyOn(document.body, "removeChild").mockImplementation((node) => node);

    fireEvent.click(screen.getByRole("button", { name: /export/i }));

    await waitFor(() => {
      expect(clickSpy).toHaveBeenCalled();
    });

    expect(createObjectURL).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:fake-url");
    expect(appendSpy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalled();
  });

  it("returns button to enabled state after successful export", async () => {
    const fakeData = { workouts: [] };
    mockExportData.mockResolvedValueOnce(fakeData);

    URL.createObjectURL = vi.fn(() => "blob:fake-url");
    URL.revokeObjectURL = vi.fn();

    render(<DataExport />);

    vi.spyOn(document.body, "appendChild").mockImplementation((node) => {
      (node as HTMLAnchorElement).click = vi.fn();
      return node;
    });
    vi.spyOn(document.body, "removeChild").mockImplementation((node) => node);

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
