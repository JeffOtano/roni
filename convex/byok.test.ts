import { describe, expect, it } from "vitest";
import { BYOK_REQUIRED_AFTER, isBYOKRequired } from "./byok";

describe("isBYOKRequired", () => {
  it("returns false for users created before BYOK_REQUIRED_AFTER (grandfathered)", () => {
    const creationTime = BYOK_REQUIRED_AFTER - 1;
    expect(isBYOKRequired(creationTime)).toBe(false);
  });

  it("returns true for users created exactly at BYOK_REQUIRED_AFTER", () => {
    expect(isBYOKRequired(BYOK_REQUIRED_AFTER)).toBe(true);
  });

  it("returns true for users created after BYOK_REQUIRED_AFTER", () => {
    const creationTime = BYOK_REQUIRED_AFTER + 1000;
    expect(isBYOKRequired(creationTime)).toBe(true);
  });
});
