import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FailureBanner } from "./FailureBanner";

describe("FailureBanner", () => {
  it("renders the invalid-key message when reason is byok_key_invalid", () => {
    render(<FailureBanner reason="byok_key_invalid" />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      /your gemini api key isn't working anymore/i,
    );
  });

  it("renders the quota message when reason is byok_quota_exceeded", () => {
    render(<FailureBanner reason="byok_quota_exceeded" />);

    expect(screen.getByRole("alert")).toHaveTextContent(/free daily limit/i);
  });

  it("renders the safety message when reason is byok_safety_blocked", () => {
    render(<FailureBanner reason="byok_safety_blocked" />);

    expect(screen.getByRole("alert")).toHaveTextContent(/declined to answer/i);
  });

  it("renders the unknown-error message when reason is byok_unknown_error", () => {
    render(<FailureBanner reason="byok_unknown_error" />);

    expect(screen.getByRole("alert")).toHaveTextContent(/something went wrong with gemini/i);
  });

  it("renders the missing-key message when reason is byok_key_missing", () => {
    render(<FailureBanner reason="byok_key_missing" />);

    expect(screen.getByRole("alert")).toHaveTextContent(/add your gemini api key/i);
  });

  it("exposes a Fix it link pointing at the settings gemini-key anchor", () => {
    render(<FailureBanner reason="byok_key_invalid" />);

    const link = screen.getByRole("link", { name: /fix it/i });
    expect(link).toHaveAttribute("href", "/settings#gemini-key");
  });

  it("uses role=alert so screen readers announce it", () => {
    render(<FailureBanner reason="byok_unknown_error" />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("renders the house-key quota message with non-destructive styling", () => {
    render(<FailureBanner reason="house_key_quota_exhausted" />);

    expect(screen.getByRole("alert")).toHaveTextContent(/500 free AI messages/i);
    // Amber/default variant should NOT have the destructive classes
    expect(screen.getByRole("alert").className).not.toMatch(/destructive/);
  });

  it("shows 'Add your key' link text for house-key quota exhaustion", () => {
    render(<FailureBanner reason="house_key_quota_exhausted" />);

    const link = screen.getByRole("link", { name: /add your key/i });
    expect(link).toHaveAttribute("href", "/settings#gemini-key");
  });
});
