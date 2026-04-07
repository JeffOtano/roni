import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OpenSourceBanner } from "./OpenSourceBanner";

const REPO_URL = "https://github.com/example/tonal-coach";
const STORAGE_KEY = "tonal-coach-oss-banner-dismissed";

describe("OpenSourceBanner", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubEnv("NEXT_PUBLIC_GITHUB_REPO_URL", REPO_URL);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renders the announcement and repo link when env var is set and not dismissed", async () => {
    render(<OpenSourceBanner />);

    expect(await screen.findByText(/tonal coach is now open source/i)).toBeInTheDocument();
    expect(screen.getByText(/your account is unchanged/i)).toBeInTheDocument();

    const link = screen.getByRole("link", { name: /read the code/i });
    expect(link).toHaveAttribute("href", REPO_URL);
  });

  it("renders nothing when NEXT_PUBLIC_GITHUB_REPO_URL is not set", async () => {
    vi.stubEnv("NEXT_PUBLIC_GITHUB_REPO_URL", "");

    const { container } = render(<OpenSourceBanner />);

    // Give any pending effects a chance to flush; banner must stay empty.
    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
    expect(screen.queryByText(/tonal coach is now open source/i)).not.toBeInTheDocument();
  });

  it("renders nothing when localStorage already marks the banner dismissed", async () => {
    window.localStorage.setItem(STORAGE_KEY, "true");

    const { container } = render(<OpenSourceBanner />);

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
    expect(screen.queryByText(/tonal coach is now open source/i)).not.toBeInTheDocument();
  });

  it("dismisses when the close button is clicked and persists the flag", async () => {
    const user = userEvent.setup();

    render(<OpenSourceBanner />);

    // Wait for the banner to appear after mount.
    await screen.findByText(/tonal coach is now open source/i);

    await user.click(screen.getByRole("button", { name: /dismiss/i }));

    await waitFor(() => {
      expect(screen.queryByText(/tonal coach is now open source/i)).not.toBeInTheDocument();
    });
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("true");
  });

  it("opens the repo link in a new tab with safe rel attributes", async () => {
    render(<OpenSourceBanner />);

    const link = await screen.findByRole("link", { name: /read the code/i });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});
