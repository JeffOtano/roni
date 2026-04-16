import { describe, expect, it } from "vitest";
import { parseYesNo } from "./prompts";

describe("parseYesNo", () => {
  it("returns true for 'y'", () => {
    expect(parseYesNo("y", false)).toBe(true);
  });

  it("returns true for 'yes'", () => {
    expect(parseYesNo("yes", false)).toBe(true);
  });

  it("returns true for 'Y' and 'YES' (case-insensitive)", () => {
    expect(parseYesNo("Y", false)).toBe(true);
    expect(parseYesNo("YES", false)).toBe(true);
  });

  it("returns false for 'n'", () => {
    expect(parseYesNo("n", true)).toBe(false);
  });

  it("returns false for 'no'", () => {
    expect(parseYesNo("no", true)).toBe(false);
  });

  it("returns the default for empty string", () => {
    expect(parseYesNo("", true)).toBe(true);
    expect(parseYesNo("", false)).toBe(false);
  });

  it("returns the default for whitespace-only input", () => {
    expect(parseYesNo("   ", true)).toBe(true);
    expect(parseYesNo("\n", false)).toBe(false);
  });

  it("returns the default for unrecognized input", () => {
    expect(parseYesNo("maybe", true)).toBe(true);
    expect(parseYesNo("maybe", false)).toBe(false);
  });
});
