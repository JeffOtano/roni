import { act, render, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider, useTheme } from "./ThemeProvider";

function wrapper({ children }: { children: ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

describe("ThemeProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  it("provides default dark theme when no stored preference", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    expect(result.current.theme).toBe("dark");
  });

  it("reads stored theme from localStorage", () => {
    localStorage.setItem("theme", "light");

    const { result } = renderHook(() => useTheme(), { wrapper });

    expect(result.current.theme).toBe("light");
  });

  it("setTheme updates the current theme", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => {
      result.current.setTheme("light");
    });

    expect(result.current.theme).toBe("light");
  });

  it("setTheme persists to localStorage", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem");
    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => {
      result.current.setTheme("light");
    });

    expect(spy).toHaveBeenCalledWith("theme", "light");
    spy.mockRestore();
  });

  it("applies dark class to documentElement for dark theme", () => {
    render(<ThemeProvider>test</ThemeProvider>);

    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("removes dark class for light theme", () => {
    localStorage.setItem("theme", "light");

    render(<ThemeProvider>test</ThemeProvider>);

    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("throws when useTheme is used outside ThemeProvider", () => {
    // Suppress React error output for expected throw
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => {
      renderHook(() => useTheme());
    }).toThrow("useTheme must be used within a ThemeProvider");

    spy.mockRestore();
  });

  it("renders children", () => {
    const { getByText } = render(<ThemeProvider>Hello</ThemeProvider>);

    expect(getByText("Hello")).toBeInTheDocument();
  });
});
