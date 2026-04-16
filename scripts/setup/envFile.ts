import fs from "node:fs";
import path from "node:path";

export type EnvMap = Record<string, string>;

const NEEDS_QUOTING = /[#\n"'\\]|^\s|\s$/;

/** Parse a .env-style file into a key/value map. Strips surrounding quotes
 *  and inline comments ("KEY=value  # note"). Skips blank / comment-only lines. */
export function parseEnvFile(content: string): EnvMap {
  const result: EnvMap = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) continue;

    const key = line.slice(0, eqIdx).trim();
    if (!key) continue;
    result[key] = unwrapValue(line.slice(eqIdx + 1));
  }
  return result;
}

/** Decode a .env value: drop inline `# comment` when not quoted, strip a
 *  single matching pair of surrounding quotes, and trim whitespace. */
function unwrapValue(raw: string): string {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2)
  ) {
    return trimmed.slice(1, -1);
  }
  const hashIdx = trimmed.indexOf(" #");
  return hashIdx === -1 ? trimmed : trimmed.slice(0, hashIdx).trimEnd();
}

/** Encode a value for a KEY=value line, quoting when required. */
function encodeValue(value: string): string {
  if (!NEEDS_QUOTING.test(value)) return value;
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
}

/** Serialize a key/value map into KEY=value lines. */
export function serializeEnvFile(env: EnvMap): string {
  const entries = Object.entries(env);
  if (entries.length === 0) return "";
  return entries.map(([k, v]) => `${k}=${encodeValue(v)}`).join("\n") + "\n";
}

/**
 * Merge new values into existing .env file content, preserving comments and order.
 * Existing keys are updated in place; new keys are appended.
 */
export function mergeEnv(existingContent: string, updates: EnvMap): string {
  if (Object.keys(updates).length === 0) return existingContent;

  const normalized =
    existingContent.length > 0 && !existingContent.endsWith("\n")
      ? existingContent + "\n"
      : existingContent;

  const lines = normalized.split("\n");
  if (lines[lines.length - 1] === "") lines.pop();

  const seen = new Set<string>();
  const outputLines = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return line;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) return line;
    const key = trimmed.slice(0, eqIdx).trim();
    if (!(key in updates)) return line;
    seen.add(key);
    return `${key}=${encodeValue(updates[key])}`;
  });

  for (const [key, value] of Object.entries(updates)) {
    if (!seen.has(key)) outputLines.push(`${key}=${encodeValue(value)}`);
  }

  return outputLines.join("\n") + "\n";
}

/** Read a .env file. Returns empty string if the file does not exist. */
export function readEnvFile(filePath: string): string {
  if (!fs.existsSync(filePath)) return "";
  return fs.readFileSync(filePath, "utf8");
}

/**
 * Atomically write content to a .env file with owner-only permissions.
 * Writes to a sibling temp file first, then renames into place, so a crash
 * mid-write can't leave the target truncated.
 */
export function writeEnvFile(filePath: string, content: string): void {
  const dir = path.dirname(filePath);
  const tmp = path.join(dir, `.${path.basename(filePath)}.${process.pid}.tmp`);
  fs.writeFileSync(tmp, content, { encoding: "utf8", mode: 0o600 });
  try {
    fs.renameSync(tmp, filePath);
    fs.chmodSync(filePath, 0o600);
  } catch (err) {
    try {
      fs.unlinkSync(tmp);
    } catch {
      // ignore cleanup failure
    }
    throw err;
  }
}
