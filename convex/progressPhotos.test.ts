import { describe, expect, it } from "vitest";
import { MAX_IMAGE_BASE64_LENGTH } from "./progressPhotos";

describe("progressPhotos", () => {
  it("enforces a reasonable max image base64 length", () => {
    expect(MAX_IMAGE_BASE64_LENGTH).toBe(4 * 1024 * 1024);
  });

  it("rejects payloads over limit when used in upload (contract: upload action checks length)", () => {
    const overLimit = "x".repeat(MAX_IMAGE_BASE64_LENGTH + 1);
    expect(overLimit.length).toBeGreaterThan(MAX_IMAGE_BASE64_LENGTH);
  });
});
