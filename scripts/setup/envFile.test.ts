import { describe, expect, it } from "vitest";
import { mergeEnv, parseEnvFile, serializeEnvFile } from "./envFile";

describe("parseEnvFile", () => {
  it("parses KEY=value lines", () => {
    const content = "FOO=bar\nBAZ=qux\n";

    const result = parseEnvFile(content);

    expect(result).toEqual({ FOO: "bar", BAZ: "qux" });
  });

  it("ignores comment lines", () => {
    const content = "# comment\nFOO=bar\n# another\nBAZ=qux\n";

    const result = parseEnvFile(content);

    expect(result).toEqual({ FOO: "bar", BAZ: "qux" });
  });

  it("ignores blank lines", () => {
    const content = "\nFOO=bar\n\n\nBAZ=qux\n";

    const result = parseEnvFile(content);

    expect(result).toEqual({ FOO: "bar", BAZ: "qux" });
  });

  it("trims whitespace around keys and values", () => {
    const content = "  FOO = bar  \n  BAZ=qux\n";

    const result = parseEnvFile(content);

    expect(result).toEqual({ FOO: "bar", BAZ: "qux" });
  });

  it("returns empty object for empty string", () => {
    expect(parseEnvFile("")).toEqual({});
  });

  it("preserves values containing equals signs", () => {
    const content = "FOO=https://example.com?a=1&b=2\n";

    const result = parseEnvFile(content);

    expect(result).toEqual({ FOO: "https://example.com?a=1&b=2" });
  });
});

describe("mergeEnv", () => {
  it("overwrites existing keys with new values", () => {
    const existing = "FOO=old\nBAZ=keep\n";

    const result = mergeEnv(existing, { FOO: "new" });

    expect(result).toContain("FOO=new");
    expect(result).toContain("BAZ=keep");
    expect(result).not.toContain("FOO=old");
  });

  it("appends new keys when none exist in source", () => {
    const existing = "FOO=bar\n";

    const result = mergeEnv(existing, { NEW_KEY: "value" });

    expect(result).toContain("FOO=bar");
    expect(result).toContain("NEW_KEY=value");
  });

  it("preserves comments and blank lines", () => {
    const existing = "# header comment\n\nFOO=bar\n# trailer\n";

    const result = mergeEnv(existing, { FOO: "updated" });

    expect(result).toContain("# header comment");
    expect(result).toContain("# trailer");
    expect(result).toContain("FOO=updated");
  });

  it("returns unchanged content when updates object is empty", () => {
    const existing = "FOO=bar\n";

    const result = mergeEnv(existing, {});

    expect(result).toBe(existing);
  });
});

describe("serializeEnvFile", () => {
  it("writes KEY=value lines separated by newlines", () => {
    const result = serializeEnvFile({ FOO: "bar", BAZ: "qux" });

    expect(result).toBe("FOO=bar\nBAZ=qux\n");
  });

  it("returns empty string for empty object", () => {
    expect(serializeEnvFile({})).toBe("");
  });
});
