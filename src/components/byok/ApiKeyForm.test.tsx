import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiKeyForm } from "./ApiKeyForm";

const VALID_KEY = "AIza" + "x".repeat(35);

describe("ApiKeyForm", () => {
  it("calls onSave with a valid key when the user submits", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(<ApiKeyForm onSave={onSave} />);

    await user.type(screen.getByLabelText(/api key/i), VALID_KEY);
    await user.click(screen.getByRole("button", { name: /save key/i }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(VALID_KEY);
    });
  });

  it("trims whitespace and newlines before validating and submitting", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(<ApiKeyForm onSave={onSave} />);

    const padded = "  " + VALID_KEY + "\n";
    // user.type interprets `{Enter}` as a key press; paste keeps newlines/whitespace literal.
    await user.click(screen.getByLabelText(/api key/i));
    await user.paste(padded);
    await user.click(screen.getByRole("button", { name: /save key/i }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(VALID_KEY);
    });
  });

  it("shows a format error and does not call onSave when the key is malformed", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(<ApiKeyForm onSave={onSave} />);

    await user.type(screen.getByLabelText(/api key/i), "not_a_key");
    await user.click(screen.getByRole("button", { name: /save key/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/key format looks wrong/i);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("shows an error and does not call onSave when the field is empty", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(<ApiKeyForm onSave={onSave} />);

    await user.click(screen.getByRole("button", { name: /save key/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/key format looks wrong/i);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("renders a Google AI Studio link that opens in a new tab", () => {
    render(<ApiKeyForm onSave={vi.fn()} />);

    const link = screen.getByRole("link", { name: /get a key from google ai studio/i });
    expect(link).toHaveAttribute("href", "https://aistudio.google.com/app/apikey");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("displays the error and re-enables the button when onSave rejects", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockRejectedValue(new Error("some error"));

    render(<ApiKeyForm onSave={onSave} />);

    await user.type(screen.getByLabelText(/api key/i), VALID_KEY);
    const button = screen.getByRole("button", { name: /save key/i });
    await user.click(button);

    expect(await screen.findByRole("alert")).toHaveTextContent("some error");
    await waitFor(() => {
      expect(button).not.toBeDisabled();
    });
  });
});
