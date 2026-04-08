import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentPropsWithoutRef } from "react";
import { describe, expect, it, vi } from "vitest";
import type { PendingImage } from "@/hooks/useImageUpload";
import { ImagePreviewRow } from "./ImagePreviewRow";

vi.mock("next/image", () => ({
  default: ({
    alt,
    unoptimized: _unoptimized,
    ...props
  }: ComponentPropsWithoutRef<"img"> & { unoptimized?: boolean }) => (
    <img {...props} alt={alt ?? ""} />
  ),
}));

function createPendingImage(name: string, previewUrl: string): PendingImage {
  return {
    file: new File(["image"], name, { type: "image/png" }),
    previewUrl,
  };
}

describe("ImagePreviewRow", () => {
  it("renders nothing when there are no images", () => {
    const { container } = render(<ImagePreviewRow images={[]} onRemove={vi.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders image previews and removes an image when asked", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();

    render(
      <ImagePreviewRow
        images={[
          createPendingImage("first.png", "blob:first"),
          createPendingImage("second.png", "blob:second"),
        ]}
        onRemove={onRemove}
      />,
    );

    expect(screen.getByAltText("Attachment 1")).toBeInTheDocument();
    expect(screen.getByAltText("Attachment 2")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove attachment 2" }));

    expect(onRemove).toHaveBeenCalledWith(1);
  });

  it("disables removal buttons when disabled", () => {
    render(
      <ImagePreviewRow
        images={[createPendingImage("first.png", "blob:first")]}
        onRemove={vi.fn()}
        disabled
      />,
    );

    expect(screen.getByRole("button", { name: "Remove attachment 1" })).toBeDisabled();
  });
});
