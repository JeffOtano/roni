import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";

// Suppress React error boundary console.error noise in test output
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

function ThrowingChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error("Test error");
  return <div>Child content</div>;
}

// next/link mock -- renders a plain anchor
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("ErrorBoundary", () => {
  it("renders children when no error occurs", () => {
    render(
      <ErrorBoundary>
        <div>Safe content</div>
      </ErrorBoundary>,
    );

    expect(screen.getByText("Safe content")).toBeInTheDocument();
  });

  it("shows error UI when a child throws", () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText(/An unexpected error occurred/)).toBeInTheDocument();
  });

  it("shows Try again button in error state", () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });

  it("shows Go home link in error state", () => {
    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByRole("link", { name: /go home/i })).toBeInTheDocument();
  });

  it("resets error state when Try again is clicked", () => {
    let shouldThrow = true;

    function ConditionalThrower() {
      if (shouldThrow) throw new Error("Test error");
      return <div>Recovered content</div>;
    }

    render(
      <ErrorBoundary>
        <ConditionalThrower />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();

    // Fix the error before clicking retry
    shouldThrow = false;

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));

    expect(screen.getByText("Recovered content")).toBeInTheDocument();
    expect(screen.queryByText("Something went wrong")).toBeNull();
  });

  it("shows error message in development mode", () => {
    const env = process.env as Record<string, string | undefined>;
    const originalEnv = env.NODE_ENV;
    env.NODE_ENV = "development";

    render(
      <ErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Test error")).toBeInTheDocument();

    env.NODE_ENV = originalEnv;
  });
});
