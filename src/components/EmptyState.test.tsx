import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EmptyState } from "./EmptyState";

// Minimal stub for LucideIcon -- renders as a span with data-testid
function MockIcon(props: Record<string, unknown>) {
  return <span data-testid="empty-icon" {...props} />;
}

describe("EmptyState", () => {
  it("renders title", () => {
    render(<EmptyState icon={MockIcon as never} title="No items" />);

    expect(screen.getByText("No items")).toBeInTheDocument();
  });

  it("renders description when provided", () => {
    render(
      <EmptyState icon={MockIcon as never} title="No items" description="Create your first item" />,
    );

    expect(screen.getByText("Create your first item")).toBeInTheDocument();
  });

  it("does not render description when not provided", () => {
    const { container } = render(<EmptyState icon={MockIcon as never} title="No items" />);

    expect(container.querySelector("p")).toBeNull();
  });

  it("renders action button when action is provided", () => {
    const onClick = vi.fn();
    render(
      <EmptyState
        icon={MockIcon as never}
        title="No items"
        action={{ label: "Add item", onClick }}
      />,
    );

    expect(screen.getByRole("button", { name: "Add item" })).toBeInTheDocument();
  });

  it("does not render button when action is not provided", () => {
    render(<EmptyState icon={MockIcon as never} title="No items" />);

    expect(screen.queryByRole("button")).toBeNull();
  });

  it("calls onClick when action button is clicked", () => {
    const onClick = vi.fn();
    render(
      <EmptyState
        icon={MockIcon as never}
        title="No items"
        action={{ label: "Add item", onClick }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add item" }));

    expect(onClick).toHaveBeenCalledOnce();
  });

  it("renders the icon", () => {
    render(<EmptyState icon={MockIcon as never} title="No items" />);

    expect(screen.getByTestId("empty-icon")).toBeInTheDocument();
  });
});
