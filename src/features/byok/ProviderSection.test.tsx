import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderSection } from "./ProviderSection";

const mockGetSettings = vi.fn();
const mockSaveKey = vi.fn();
const mockRemoveKey = vi.fn();
const mockSelectProvider = vi.fn();
const mockSetModelOverride = vi.fn();

let mockByokStatus:
  | {
      requiresBYOK: boolean;
      hasKey: boolean;
    }
  | undefined;

vi.mock("convex/react", () => ({
  useAction: (ref: string) => {
    if (ref === "byokProvider:getProviderSettings") return mockGetSettings;
    if (ref === "byok:saveProviderKey") return mockSaveKey;
    throw new Error(`Unexpected action ${ref}`);
  },
  useMutation: (ref: string) => {
    if (ref === "byok:removeProviderKey") return mockRemoveKey;
    if (ref === "byok:setSelectedProvider") return mockSelectProvider;
    if (ref === "byok:setModelOverride") return mockSetModelOverride;
    throw new Error(`Unexpected mutation ${ref}`);
  },
  useQuery: () => mockByokStatus,
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    byok: {
      getBYOKStatus: "byok:getBYOKStatus",
      removeProviderKey: "byok:removeProviderKey",
      saveProviderKey: "byok:saveProviderKey",
      setModelOverride: "byok:setModelOverride",
      setSelectedProvider: "byok:setSelectedProvider",
    },
    byokProvider: {
      getProviderSettings: "byokProvider:getProviderSettings",
    },
  },
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe("ProviderSection", () => {
  beforeEach(() => {
    mockGetSettings.mockReset();
    mockSaveKey.mockReset();
    mockRemoveKey.mockReset();
    mockSelectProvider.mockReset();
    mockSetModelOverride.mockReset();
    mockByokStatus = {
      requiresBYOK: true,
      hasKey: true,
    };
  });

  it("does not show a false settings load error after removing the last key", async () => {
    mockGetSettings
      .mockResolvedValueOnce({
        selectedProvider: "gemini",
        modelOverride: null,
        keys: {
          gemini: { hasKey: true, maskedLast4: "1234", addedAt: 1700000000000 },
          claude: { hasKey: false },
          openai: { hasKey: false },
          openrouter: { hasKey: false },
        },
      })
      .mockResolvedValueOnce(null);
    mockRemoveKey.mockResolvedValueOnce(undefined);

    render(<ProviderSection />);

    expect(await screen.findByText(/key ending in/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /remove key/i }));

    await waitFor(() => {
      expect(mockRemoveKey).toHaveBeenCalledWith({ provider: "gemini" });
      expect(mockGetSettings).toHaveBeenCalledTimes(2);
    });

    expect(
      screen.queryByText("Failed to load provider settings. Try again."),
    ).not.toBeInTheDocument();
  });
});
