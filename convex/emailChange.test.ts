import { describe, expect, it } from "vitest";
import { emailChangeHtml, generateNumericCode, hashCode } from "./emailChange";

// ---------------------------------------------------------------------------
// generateNumericCode
// ---------------------------------------------------------------------------

describe("generateNumericCode", () => {
  it("returns a string of exactly the requested length", () => {
    const code = generateNumericCode(8);

    expect(code).toHaveLength(8);
  });

  it("returns only digit characters", () => {
    const code = generateNumericCode(8);

    expect(code).toMatch(/^\d+$/);
  });

  it("zero-pads when the generated number is short", () => {
    // Run many iterations to increase the chance of hitting a short number
    for (let i = 0; i < 20; i++) {
      const code = generateNumericCode(8);
      expect(code).toHaveLength(8);
      expect(code).toMatch(/^\d{8}$/);
    }
  });

  it("works for length 4", () => {
    const code = generateNumericCode(4);

    expect(code).toHaveLength(4);
    expect(code).toMatch(/^\d{4}$/);
  });

  it("returns different values on subsequent calls (random)", () => {
    const codes = new Set(Array.from({ length: 10 }, () => generateNumericCode(8)));

    // With 10-digit space there's virtually no chance all 10 are identical
    expect(codes.size).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------
// hashCode
// ---------------------------------------------------------------------------

describe("hashCode", () => {
  it("returns a 64-character lowercase hex string (SHA-256)", async () => {
    const hash = await hashCode("12345678");

    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic — same input produces same hash", async () => {
    const a = await hashCode("same-code");
    const b = await hashCode("same-code");

    expect(a).toBe(b);
  });

  it("produces different hashes for different inputs", async () => {
    const a = await hashCode("code-a");
    const b = await hashCode("code-b");

    expect(a).not.toBe(b);
  });

  it("handles an empty string without throwing", async () => {
    const hash = await hashCode("");

    expect(hash).toHaveLength(64);
  });

  it("handles unicode input", async () => {
    const hash = await hashCode("cödé-ñoël");

    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("handles numeric string codes", async () => {
    const hash = await hashCode("00000000");

    expect(hash).toHaveLength(64);
  });
});

// ---------------------------------------------------------------------------
// emailChangeHtml
// ---------------------------------------------------------------------------

describe("emailChangeHtml", () => {
  it("includes the verification code in the output HTML", () => {
    const code = "12345678";

    const html = emailChangeHtml(code);

    expect(html).toContain(code);
  });

  it("mentions the 15-minute expiry", () => {
    const html = emailChangeHtml("00000000");

    expect(html).toContain("15 minutes");
  });

  it("contains the tonal.coach brand name", () => {
    const html = emailChangeHtml("00000000");

    expect(html.toLowerCase()).toContain("tonal.coach");
  });

  it("returns a non-empty string", () => {
    const html = emailChangeHtml("12345678");

    expect(html.length).toBeGreaterThan(0);
  });

  it("renders different code values correctly", () => {
    const html1 = emailChangeHtml("11111111");
    const html2 = emailChangeHtml("99999999");

    expect(html1).toContain("11111111");
    expect(html2).toContain("99999999");
    expect(html1).not.toContain("99999999");
    expect(html2).not.toContain("11111111");
  });
});
