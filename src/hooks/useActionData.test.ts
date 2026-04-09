import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useActionData } from "./useActionData";

describe("useActionData", () => {
  it("starts in loading state", () => {
    const action = vi.fn(() => new Promise<string>(() => {}));

    const { result } = renderHook(() => useActionData(action));

    expect(result.current.state).toEqual({ status: "loading" });
  });

  it("transitions to success with data when action resolves", async () => {
    const action = vi.fn(() => Promise.resolve("test-data"));

    const { result } = renderHook(() => useActionData(action));

    await waitFor(() => {
      expect(result.current.state).toEqual({ status: "success", data: "test-data" });
    });
    expect(action).toHaveBeenCalledWith({});
  });

  it("transitions to error when action rejects", async () => {
    const action = vi.fn(() => Promise.reject(new Error("fail")));

    const { result } = renderHook(() => useActionData(action));

    await waitFor(() => {
      expect(result.current.state).toEqual({ status: "error" });
    });
  });

  it("sets lastUpdatedAt on success", async () => {
    const action = vi.fn(() => Promise.resolve("data"));

    const { result } = renderHook(() => useActionData(action));

    await waitFor(() => {
      expect(result.current.lastUpdatedAt).toBeTypeOf("number");
    });
  });

  it("refetch transitions through refreshing state on success", async () => {
    let callCount = 0;
    const action = vi.fn(() => Promise.resolve(`data-${++callCount}`));

    const { result } = renderHook(() => useActionData(action));

    await waitFor(() => {
      expect(result.current.state.status).toBe("success");
    });

    act(() => {
      result.current.refetch();
    });

    // After calling refetch, should be in refreshing with previous data
    expect(result.current.state.status).toBe("refreshing");
    if (result.current.state.status === "refreshing") {
      expect(result.current.state.data).toBe("data-1");
    }

    await waitFor(() => {
      expect(result.current.state).toEqual({ status: "success", data: "data-2" });
    });
  });

  it("refetch preserves data when re-fetch fails from refreshing state", async () => {
    let callCount = 0;
    const action = vi.fn(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve("original");
      return Promise.reject(new Error("fail"));
    });

    const { result } = renderHook(() => useActionData(action));

    await waitFor(() => {
      expect(result.current.state.status).toBe("success");
    });

    act(() => {
      result.current.refetch();
    });

    await waitFor(() => {
      // Should fall back to success with original data
      expect(result.current.state).toEqual({ status: "success", data: "original" });
    });
  });

  it("refetch from error state goes to loading", async () => {
    let callCount = 0;
    const action = vi.fn(() => {
      callCount++;
      if (callCount === 1) return Promise.reject(new Error("fail"));
      return Promise.resolve("recovered");
    });

    const { result } = renderHook(() => useActionData(action));

    await waitFor(() => {
      expect(result.current.state.status).toBe("error");
    });

    act(() => {
      result.current.refetch();
    });

    expect(result.current.state.status).toBe("loading");

    await waitFor(() => {
      expect(result.current.state).toEqual({ status: "success", data: "recovered" });
    });
  });
});
