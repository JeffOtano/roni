import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExerciseExclusions } from "./ExerciseExclusions";
import { toast } from "sonner";

const mockSearchCatalog = vi.fn();
const mockAddExclusion = vi.fn();
const mockRemoveExclusion = vi.fn();
let mockExclusions: unknown;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

function catalogEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: "movement-row",
    name: "Seated Row",
    muscleGroups: ["Back", "Biceps"],
    skillLevel: 1,
    onMachine: true,
    ...overrides,
  };
}

function exclusion(overrides: Record<string, unknown> = {}) {
  return {
    movementId: "movement-row",
    movementName: "Seated Row",
    muscleGroups: ["Back", "Biceps"],
    createdAt: 1000,
    ...overrides,
  };
}

vi.mock("convex/react", () => ({
  useAction: () => mockSearchCatalog,
  useMutation: (ref: string) => {
    if (ref === "exerciseExclusions:addMine") return mockAddExclusion;
    if (ref === "exerciseExclusions:removeMine") return mockRemoveExclusion;
    throw new Error(`Unexpected mutation ${ref}`);
  },
  useQuery: () => mockExclusions,
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    exerciseExclusions: {
      addMine: "exerciseExclusions:addMine",
      listMine: "exerciseExclusions:listMine",
      removeMine: "exerciseExclusions:removeMine",
    },
    workoutDetail: {
      getExerciseCatalog: "workoutDetail:getExerciseCatalog",
    },
  },
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe("ExerciseExclusions", () => {
  beforeEach(() => {
    mockSearchCatalog.mockReset();
    mockAddExclusion.mockReset();
    mockRemoveExclusion.mockReset();
    vi.mocked(toast.error).mockReset();
    vi.mocked(toast.success).mockReset();
    mockExclusions = [];
  });

  it("searches the catalog and adds an exercise exclusion", async () => {
    mockSearchCatalog.mockResolvedValueOnce([
      {
        id: "movement-row",
        name: "Seated Row",
        muscleGroups: ["Back", "Biceps"],
        skillLevel: 1,
        onMachine: true,
      },
    ]);
    mockAddExclusion.mockResolvedValueOnce(undefined);

    render(<ExerciseExclusions />);

    fireEvent.change(screen.getByLabelText(/search exercises to exclude/i), {
      target: { value: "row" },
    });

    await waitFor(() => {
      expect(mockSearchCatalog).toHaveBeenCalledWith({ search: "row" });
    });
    expect(await screen.findByText("Seated Row")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /exclude seated row/i }));

    await waitFor(() => {
      expect(mockAddExclusion).toHaveBeenCalledWith({ movementId: "movement-row" });
    });
  });

  it("ignores stale search results when a newer query resolves first", async () => {
    vi.useFakeTimers();
    const rowSearch = deferred<ReturnType<typeof catalogEntry>[]>();
    const curlSearch = deferred<ReturnType<typeof catalogEntry>[]>();
    mockSearchCatalog
      .mockReturnValueOnce(rowSearch.promise)
      .mockReturnValueOnce(curlSearch.promise);

    try {
      render(<ExerciseExclusions />);

      fireEvent.change(screen.getByLabelText(/search exercises to exclude/i), {
        target: { value: "row" },
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(250);
      });

      fireEvent.change(screen.getByLabelText(/search exercises to exclude/i), {
        target: { value: "curl" },
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(250);
      });

      expect(mockSearchCatalog).toHaveBeenNthCalledWith(1, { search: "row" });
      expect(mockSearchCatalog).toHaveBeenNthCalledWith(2, { search: "curl" });

      await act(async () => {
        curlSearch.resolve([catalogEntry({ id: "movement-curl", name: "Bicep Curl" })]);
        await Promise.resolve();
      });
      expect(screen.getByText("Bicep Curl")).toBeInTheDocument();

      await act(async () => {
        rowSearch.resolve([catalogEntry()]);
        await Promise.resolve();
      });

      expect(screen.queryByText("Seated Row")).not.toBeInTheDocument();
      expect(screen.getByText("Bicep Curl")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps each clicked exercise pending independently", async () => {
    const rowAdd = deferred<void>();
    const curlAdd = deferred<void>();
    mockSearchCatalog.mockResolvedValueOnce([
      catalogEntry(),
      catalogEntry({
        id: "movement-curl",
        name: "Bicep Curl",
        muscleGroups: ["Biceps"],
      }),
    ]);
    mockAddExclusion.mockReturnValueOnce(rowAdd.promise).mockReturnValueOnce(curlAdd.promise);

    render(<ExerciseExclusions />);

    fireEvent.change(screen.getByLabelText(/search exercises to exclude/i), {
      target: { value: "row" },
    });

    expect(await screen.findByText("Seated Row")).toBeInTheDocument();

    const rowButton = screen.getByRole("button", { name: /exclude seated row/i });
    const curlButton = screen.getByRole("button", { name: /exclude bicep curl/i });
    fireEvent.click(rowButton);
    fireEvent.click(curlButton);

    await waitFor(() => {
      expect(rowButton).toBeDisabled();
      expect(curlButton).toBeDisabled();
    });

    rowAdd.resolve();
    curlAdd.resolve();
  });

  it("shows when all matching exercises are already excluded", async () => {
    mockExclusions = [exclusion()];
    mockSearchCatalog.mockResolvedValueOnce([catalogEntry()]);

    render(<ExerciseExclusions />);

    fireEvent.change(screen.getByLabelText(/search exercises to exclude/i), {
      target: { value: "row" },
    });

    expect(await screen.findByText("All matching exercises are excluded.")).toBeInTheDocument();
    expect(screen.queryByText("No matching exercises.")).not.toBeInTheDocument();
  });

  it("shows an error state when search fails", async () => {
    mockSearchCatalog.mockRejectedValueOnce(new Error("Search unavailable"));

    render(<ExerciseExclusions />);

    fireEvent.change(screen.getByLabelText(/search exercises to exclude/i), {
      target: { value: "row" },
    });

    expect(await screen.findByText(/search failed/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });

  it("shows the add error message when excluding fails", async () => {
    mockSearchCatalog.mockResolvedValueOnce([catalogEntry()]);
    mockAddExclusion.mockRejectedValueOnce(new Error("Cannot exclude exercise"));

    render(<ExerciseExclusions />);

    fireEvent.change(screen.getByLabelText(/search exercises to exclude/i), {
      target: { value: "row" },
    });
    expect(await screen.findByText("Seated Row")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /exclude seated row/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Cannot exclude exercise");
    });
  });

  it("shows the remove error message when restoring fails", async () => {
    mockExclusions = [
      exclusion({
        movementId: "movement-lateral-raise",
        movementName: "Lateral Raise",
        muscleGroups: ["Shoulders"],
      }),
    ];
    mockRemoveExclusion.mockRejectedValueOnce(new Error("Cannot restore exercise"));

    render(<ExerciseExclusions />);

    fireEvent.click(screen.getByRole("button", { name: /remove lateral raise/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Cannot restore exercise");
    });
  });

  it("does not search before the minimum query length", async () => {
    vi.useFakeTimers();

    try {
      render(<ExerciseExclusions />);

      fireEvent.change(screen.getByLabelText(/search exercises to exclude/i), {
        target: { value: "r" },
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(250);
      });

      expect(mockSearchCatalog).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("renders existing exclusions and removes one", async () => {
    mockExclusions = [
      exclusion({
        movementId: "movement-lateral-raise",
        movementName: "Lateral Raise",
        muscleGroups: ["Shoulders"],
      }),
    ];
    mockRemoveExclusion.mockResolvedValueOnce({ removed: true });

    render(<ExerciseExclusions />);

    expect(screen.getByText("Lateral Raise")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /remove lateral raise/i }));

    await waitFor(() => {
      expect(mockRemoveExclusion).toHaveBeenCalledWith({
        movementId: "movement-lateral-raise",
      });
    });
  });
});
