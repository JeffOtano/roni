import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("merges multiple class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles conditional classes via clsx syntax", () => {
    expect(cn("base", false && "hidden", "extra")).toBe("base extra");
  });

  it("resolves tailwind-merge conflicts in favor of last class", () => {
    expect(cn("px-4", "px-6")).toBe("px-6");
  });

  it("resolves conflicting text colors", () => {
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  it("returns empty string when given no arguments", () => {
    expect(cn()).toBe("");
  });

  it("handles undefined and null values", () => {
    expect(cn("base", undefined, null, "end")).toBe("base end");
  });

  it("handles array inputs", () => {
    expect(cn(["foo", "bar"])).toBe("foo bar");
  });

  it("merges conflicting margin classes", () => {
    expect(cn("mt-2", "mt-4")).toBe("mt-4");
  });
});
