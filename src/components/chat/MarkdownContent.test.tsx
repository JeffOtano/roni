import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MarkdownContent } from "./MarkdownContent";

let writeTextMock: ReturnType<typeof vi.spyOn>;

describe("MarkdownContent", () => {
  beforeEach(() => {
    if (!navigator.clipboard) {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async () => undefined,
        },
      });
    }

    writeTextMock = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);
  });

  it("renders headings, links, inline code, and tables", () => {
    render(
      <MarkdownContent
        content={`## Recovery\n\nUse \`RPE\` to guide intensity.\n\n| Day | Focus |\n| --- | --- |\n| Mon | Push |\n\n[Docs](https://example.com/docs)`}
      />,
    );

    expect(screen.getByRole("heading", { level: 2, name: "Recovery" })).toBeInTheDocument();
    expect(screen.getByText("RPE")).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();

    const link = screen.getByRole("link", { name: "Docs" });
    expect(link).toHaveAttribute("href", "https://example.com/docs");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("copies fenced code blocks to the clipboard", async () => {
    render(
      <MarkdownContent content={`\`\`\`ts\nconst plan = "push";\nconsole.log(plan);\n\`\`\``} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Copy code" }));

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith('const plan = "push";\nconsole.log(plan);\n');
    });
  });
});
