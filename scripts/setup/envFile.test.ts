import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mergeEnv, parseEnvFile, readEnvFile, serializeEnvFile, writeEnvFile } from "./envFile";

describe("parseEnvFile", () => {
  it("parses KEY=value lines", () => {
    expect(parseEnvFile("FOO=bar\nBAZ=qux\n")).toEqual({ FOO: "bar", BAZ: "qux" });
  });

  it("ignores comment lines and blank lines", () => {
    expect(parseEnvFile("# header\n\nFOO=bar\n# mid\nBAZ=qux\n")).toEqual({
      FOO: "bar",
      BAZ: "qux",
    });
  });

  it("trims whitespace around keys and values", () => {
    expect(parseEnvFile("  FOO = bar  \n  BAZ=qux\n")).toEqual({ FOO: "bar", BAZ: "qux" });
  });

  it("returns empty object for empty string", () => {
    expect(parseEnvFile("")).toEqual({});
  });

  it("preserves values containing equals signs", () => {
    expect(parseEnvFile("FOO=https://example.com?a=1&b=2\n")).toEqual({
      FOO: "https://example.com?a=1&b=2",
    });
  });

  it("strips surrounding double quotes", () => {
    expect(parseEnvFile('FOO="bar baz"\n')).toEqual({ FOO: "bar baz" });
  });

  it("strips surrounding single quotes", () => {
    expect(parseEnvFile("FOO='bar baz'\n")).toEqual({ FOO: "bar baz" });
  });

  it("strips inline ' # comment' trailers on unquoted values", () => {
    expect(parseEnvFile("FOO=bar # trailing comment\n")).toEqual({ FOO: "bar" });
  });

  it("keeps '#' inside a quoted value", () => {
    expect(parseEnvFile('FOO="value #not-a-comment"\n')).toEqual({ FOO: "value #not-a-comment" });
  });

  it("handles CRLF line endings", () => {
    expect(parseEnvFile("FOO=bar\r\nBAZ=qux\r\n")).toEqual({ FOO: "bar", BAZ: "qux" });
  });
});

describe("mergeEnv", () => {
  it("overwrites existing keys with new values", () => {
    const result = mergeEnv("FOO=old\nBAZ=keep\n", { FOO: "new" });

    expect(result).toContain("FOO=new");
    expect(result).toContain("BAZ=keep");
    expect(result).not.toContain("FOO=old");
  });

  it("appends new keys when none exist in source", () => {
    const result = mergeEnv("FOO=bar\n", { NEW_KEY: "value" });

    expect(result).toContain("FOO=bar");
    expect(result).toContain("NEW_KEY=value");
  });

  it("preserves comments and blank lines", () => {
    const result = mergeEnv("# header\n\nFOO=bar\n# trailer\n", { FOO: "updated" });

    expect(result).toContain("# header");
    expect(result).toContain("# trailer");
    expect(result).toContain("FOO=updated");
  });

  it("returns unchanged content when updates object is empty", () => {
    expect(mergeEnv("FOO=bar\n", {})).toBe("FOO=bar\n");
  });

  it("appends a trailing newline when source lacks one", () => {
    const result = mergeEnv("FOO=bar", { NEW_KEY: "value" });

    expect(result.endsWith("\n")).toBe(true);
    expect(result).toContain("FOO=bar");
    expect(result).toContain("NEW_KEY=value");
  });

  it("quotes values that contain special characters", () => {
    const result = mergeEnv("", { HAS_HASH: "value#with-hash" });

    expect(result).toContain('HAS_HASH="value#with-hash"');
  });
});

describe("serializeEnvFile", () => {
  it("writes KEY=value lines separated by newlines", () => {
    expect(serializeEnvFile({ FOO: "bar", BAZ: "qux" })).toBe("FOO=bar\nBAZ=qux\n");
  });

  it("returns empty string for empty object", () => {
    expect(serializeEnvFile({})).toBe("");
  });

  it("quotes values containing hash, newline, or leading/trailing whitespace", () => {
    const result = serializeEnvFile({ A: "plain", B: "has space ", C: "has#hash" });

    expect(result).toContain("A=plain");
    expect(result).toContain('B="has space "');
    expect(result).toContain('C="has#hash"');
  });
});

describe("writeEnvFile", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "envfile-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("writes the content and reads back identically", () => {
    const target = path.join(tmpDir, ".env.local");

    writeEnvFile(target, "FOO=bar\n");

    expect(readEnvFile(target)).toBe("FOO=bar\n");
  });

  it("writes the file with owner-only permissions on POSIX", () => {
    if (process.platform === "win32") return;
    const target = path.join(tmpDir, ".env.local");

    writeEnvFile(target, "FOO=bar\n");

    const mode = fs.statSync(target).mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it("leaves no temp file behind on successful write", () => {
    const target = path.join(tmpDir, ".env.local");

    writeEnvFile(target, "FOO=bar\n");

    const siblings = fs.readdirSync(tmpDir);
    expect(siblings).toEqual([".env.local"]);
  });
});
