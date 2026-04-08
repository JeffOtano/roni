import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AsyncCard } from "./AsyncCard";

describe("AsyncCard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-08T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders a loading skeleton", () => {
    render(
      <AsyncCard state={{ status: "loading" }} refetch={vi.fn()} title="Training load" tall>
        {() => null}
      </AsyncCard>,
    );

    expect(screen.getByRole("status", { name: "Loading" })).toHaveClass("min-h-[300px]");
  });

  it("renders an error card and retries", () => {
    const refetch = vi.fn();

    render(
      <AsyncCard state={{ status: "error" }} refetch={refetch} title="Recovery">
        {() => null}
      </AsyncCard>,
    );

    expect(screen.getByText("Failed to load data.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(refetch).toHaveBeenCalledOnce();
    expect(screen.getByRole("link", { name: "reconnecting your Tonal" })).toHaveAttribute(
      "href",
      "/connect-tonal",
    );
  });

  it("renders refreshing data and updates the relative timestamp", () => {
    render(
      <AsyncCard
        state={{ status: "refreshing", data: "3 sessions" }}
        refetch={vi.fn()}
        lastUpdatedAt={new Date("2026-04-08T11:59:15Z").valueOf()}
        title="Consistency"
      >
        {(data) => <div>{data}</div>}
      </AsyncCard>,
    );

    expect(screen.getByText("Consistency")).toBeInTheDocument();
    expect(screen.getByText("3 sessions")).toBeInTheDocument();
    expect(screen.getByLabelText("Refreshing")).toBeInTheDocument();
    expect(screen.getByText("Updated just now")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(screen.getByText("Updated 1m ago")).toBeInTheDocument();
  });
});
