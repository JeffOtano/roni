import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChangePassword } from "./ChangePassword";

const mockChangePassword = vi.fn();

vi.mock("convex/react", () => ({
  useAction: () => mockChangePassword,
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    account: {
      changePassword: "account:changePassword",
    },
  },
}));

describe("ChangePassword", () => {
  beforeEach(() => {
    mockChangePassword.mockReset();
  });

  it("renders collapsed state with Change Password text", () => {
    render(<ChangePassword />);

    expect(screen.getByText("Change Password")).toBeInTheDocument();
    expect(screen.queryByLabelText("Current password")).toBeNull();
  });

  it("expands on click to show the form", () => {
    render(<ChangePassword />);

    fireEvent.click(screen.getByText("Change Password"));

    expect(screen.getByLabelText("Current password")).toBeInTheDocument();
    expect(screen.getByLabelText("New password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm new password")).toBeInTheDocument();
  });

  it("toggle button has aria-expanded reflecting open state", () => {
    render(<ChangePassword />);

    const btn = screen.getByRole("button", { name: /change password/i });
    expect(btn).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "true");
  });

  it("collapses again when clicked a second time", () => {
    render(<ChangePassword />);

    fireEvent.click(screen.getByText("Change Password"));
    expect(screen.getByLabelText("Current password")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Change Password"));
    expect(screen.queryByLabelText("Current password")).toBeNull();
  });

  it("shows error when new passwords do not match", async () => {
    render(<ChangePassword />);
    fireEvent.click(screen.getByText("Change Password"));

    fireEvent.change(screen.getByLabelText("Current password"), {
      target: { value: "oldpass1" },
    });
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "newpass1" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "different" },
    });
    fireEvent.submit(screen.getByRole("button", { name: /update password/i }).closest("form")!);

    expect(await screen.findByRole("alert")).toHaveTextContent("New passwords do not match.");
    expect(mockChangePassword).not.toHaveBeenCalled();
  });

  it("shows error when new password is shorter than 8 characters", async () => {
    render(<ChangePassword />);
    fireEvent.click(screen.getByText("Change Password"));

    fireEvent.change(screen.getByLabelText("Current password"), {
      target: { value: "oldpass1" },
    });
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "short" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "short" },
    });
    fireEvent.submit(screen.getByRole("button", { name: /update password/i }).closest("form")!);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Password must be at least 8 characters.",
    );
    expect(mockChangePassword).not.toHaveBeenCalled();
  });

  it("shows success state after changePassword resolves", async () => {
    mockChangePassword.mockResolvedValueOnce(undefined);
    render(<ChangePassword />);
    fireEvent.click(screen.getByText("Change Password"));

    fireEvent.change(screen.getByLabelText("Current password"), {
      target: { value: "oldpass1" },
    });
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "newpass123" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "newpass123" },
    });
    fireEvent.submit(screen.getByRole("button", { name: /update password/i }).closest("form")!);

    expect(await screen.findByRole("status")).toHaveTextContent("Password changed successfully.");
  });

  it("shows error state when changePassword throws", async () => {
    mockChangePassword.mockRejectedValueOnce(new Error("Incorrect current password."));
    render(<ChangePassword />);
    fireEvent.click(screen.getByText("Change Password"));

    fireEvent.change(screen.getByLabelText("Current password"), {
      target: { value: "wrongpass" },
    });
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "newpass123" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "newpass123" },
    });
    fireEvent.submit(screen.getByRole("button", { name: /update password/i }).closest("form")!);

    expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect current password.");
  });

  it("calls changePassword action with correct arguments on submit", async () => {
    mockChangePassword.mockResolvedValueOnce(undefined);
    render(<ChangePassword />);
    fireEvent.click(screen.getByText("Change Password"));

    fireEvent.change(screen.getByLabelText("Current password"), {
      target: { value: "oldpass1" },
    });
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "newpass123" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "newpass123" },
    });
    fireEvent.submit(screen.getByRole("button", { name: /update password/i }).closest("form")!);

    await waitFor(() => {
      expect(mockChangePassword).toHaveBeenCalledWith({
        oldPassword: "oldpass1",
        newPassword: "newpass123",
      });
    });
  });

  it("disables submit button while loading", async () => {
    mockChangePassword.mockImplementation(() => new Promise(() => {}));
    render(<ChangePassword />);
    fireEvent.click(screen.getByText("Change Password"));

    fireEvent.change(screen.getByLabelText("Current password"), {
      target: { value: "oldpass1" },
    });
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "newpass123" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "newpass123" },
    });
    fireEvent.submit(screen.getByRole("button", { name: /update password/i }).closest("form")!);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /update password/i })).toBeDisabled();
    });
  });
});
