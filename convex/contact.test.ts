import { describe, expect, it } from "vitest";
import { sanitizeForDiscord } from "./contact";

describe("sanitizeForDiscord", () => {
  it("strips @everyone mentions", () => {
    expect(sanitizeForDiscord("hello @everyone")).toBe("hello @\u200beveryone");
  });

  it("strips @here mentions", () => {
    expect(sanitizeForDiscord("alert @here now")).toBe("alert @\u200bhere now");
  });

  it("is case-insensitive", () => {
    expect(sanitizeForDiscord("@Everyone @HERE")).toBe("@\u200bEveryone @\u200bHERE");
  });

  it("passes through normal text unchanged", () => {
    const input = "Hello, I have a question about pricing.";
    expect(sanitizeForDiscord(input)).toBe(input);
  });

  it("handles multiple mentions in one string", () => {
    expect(sanitizeForDiscord("@everyone and @here")).toBe("@\u200beveryone and @\u200bhere");
  });
});
