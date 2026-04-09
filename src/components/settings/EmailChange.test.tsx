import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EmailChange } from "./EmailChange";

const mockRequestChange = vi.fn();
const mockConfirmChange = vi.fn();

vi.mock("convex/react", () => ({
  useAction: (ref: string) => {
    if (ref === "emailChange:requestEmailChange") return mockRequestChange;
    if (ref === "emailChange:confirmEmailChange") return mockConfirmChange;
    return vi.fn();
  },
}));

vi.mock("../../../convex/_generated/api", () => ({
  api: {
    emailChange: {
      requestEmailChange: "emailChange:requestEmailChange",
      confirmEmailChange: "emailChange:confirmEmailChange",
    },
  },
}));

const CURRENT_EMAIL = "user@example.com";

function renderComponent() {
  return render(<EmailChange currentEmail={CURRENT_EMAIL} />);
}

describe("EmailChange", () => {
  beforeEach(() => {
    mockRequestChange.mockReset();
    mockConfirmChange.mockReset();
  });

  it("shows collapsed state with Change Email text", () => {
    renderComponent();

    expect(screen.getByText("Change Email")).toBeInTheDocument();
    expect(screen.queryByLabelText("New email address")).toBeNull();
  });

  it("expands to show email input on click", () => {
    renderComponent();

    fireEvent.click(screen.getByText("Change Email"));

    expect(screen.getByLabelText("New email address")).toBeInTheDocument();
    expect(screen.getByText(`Current email:`)).toBeInTheDocument();
    expect(screen.getByText(CURRENT_EMAIL)).toBeInTheDocument();
  });

  it("shows error when new email equals current email", async () => {
    renderComponent();
    fireEvent.click(screen.getByText("Change Email"));

    fireEvent.change(screen.getByLabelText("New email address"), {
      target: { value: CURRENT_EMAIL },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: /send verification code/i }).closest("form")!,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "New email must be different from your current email.",
    );
    expect(mockRequestChange).not.toHaveBeenCalled();
  });

  it("step 1: calls requestChange and advances to code input on success", async () => {
    mockRequestChange.mockResolvedValueOnce(undefined);
    renderComponent();
    fireEvent.click(screen.getByText("Change Email"));

    fireEvent.change(screen.getByLabelText("New email address"), {
      target: { value: "new@example.com" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: /send verification code/i }).closest("form")!,
    );

    await waitFor(() => {
      expect(mockRequestChange).toHaveBeenCalledWith({ newEmail: "new@example.com" });
    });

    expect(await screen.findByLabelText("Verification code")).toBeInTheDocument();
  });

  it("step 1: shows error when requestChange throws", async () => {
    mockRequestChange.mockRejectedValueOnce(new Error("Email already in use."));
    renderComponent();
    fireEvent.click(screen.getByText("Change Email"));

    fireEvent.change(screen.getByLabelText("New email address"), {
      target: { value: "new@example.com" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: /send verification code/i }).closest("form")!,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent("Email already in use.");
  });

  it("step 2: shows code input with the new email in instructions", async () => {
    mockRequestChange.mockResolvedValueOnce(undefined);
    renderComponent();
    fireEvent.click(screen.getByText("Change Email"));

    fireEvent.change(screen.getByLabelText("New email address"), {
      target: { value: "new@example.com" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: /send verification code/i }).closest("form")!,
    );

    await screen.findByLabelText("Verification code");
    expect(screen.getByText("new@example.com")).toBeInTheDocument();
  });

  it("step 2: back button returns to email input step", async () => {
    mockRequestChange.mockResolvedValueOnce(undefined);
    renderComponent();
    fireEvent.click(screen.getByText("Change Email"));

    fireEvent.change(screen.getByLabelText("New email address"), {
      target: { value: "new@example.com" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: /send verification code/i }).closest("form")!,
    );

    await screen.findByLabelText("Verification code");
    fireEvent.click(screen.getByRole("button", { name: /back/i }));

    expect(await screen.findByLabelText("New email address")).toBeInTheDocument();
    expect(screen.queryByLabelText("Verification code")).toBeNull();
  });

  it("step 2: shows error when code is too short", async () => {
    mockRequestChange.mockResolvedValueOnce(undefined);
    renderComponent();
    fireEvent.click(screen.getByText("Change Email"));

    fireEvent.change(screen.getByLabelText("New email address"), {
      target: { value: "new@example.com" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: /send verification code/i }).closest("form")!,
    );

    await screen.findByLabelText("Verification code");

    fireEvent.change(screen.getByLabelText("Verification code"), {
      target: { value: "123" },
    });
    fireEvent.submit(screen.getByRole("button", { name: /verify and update/i }).closest("form")!);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Please enter the verification code.",
    );
    expect(mockConfirmChange).not.toHaveBeenCalled();
  });

  it("step 3: shows success message after confirmChange resolves", async () => {
    mockRequestChange.mockResolvedValueOnce(undefined);
    mockConfirmChange.mockResolvedValueOnce(undefined);
    renderComponent();
    fireEvent.click(screen.getByText("Change Email"));

    fireEvent.change(screen.getByLabelText("New email address"), {
      target: { value: "new@example.com" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: /send verification code/i }).closest("form")!,
    );

    await screen.findByLabelText("Verification code");

    fireEvent.change(screen.getByLabelText("Verification code"), {
      target: { value: "123456" },
    });
    fireEvent.submit(screen.getByRole("button", { name: /verify and update/i }).closest("form")!);

    await waitFor(() => {
      expect(screen.getByText(/email updated to new@example\.com/i)).toBeInTheDocument();
    });
  });
});
