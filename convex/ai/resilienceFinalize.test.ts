import { describe, expect, it } from "vitest";
import { getFinalizeCodeForError } from "./resilience";

describe("getFinalizeCodeForError", () => {
  it("uses transient kind codes instead of raw provider messages", () => {
    const error = new Error(
      "This model is currently experiencing high demand. Please try again later.",
    );

    const finalizeCode = getFinalizeCodeForError(error);

    expect(finalizeCode).toBe("provider_overload");
    expect(finalizeCode).not.toContain("high demand");
  });

  it("uses the Error name for non-transient errors", () => {
    const error = new Error("database blew up unexpectedly");

    const finalizeCode = getFinalizeCodeForError(error);

    expect(finalizeCode).toBe("Error");
    expect(finalizeCode).not.toBe(error.message);
  });

  it("falls back to unknown_error for non-Error values", () => {
    const finalizeCode = getFinalizeCodeForError("oops string");

    expect(finalizeCode).toBe("unknown_error");
  });
});
