import fs from "node:fs";

export type EnvMap = Record<string, string>;

/** Parse a .env-style file into a key/value map. Skips comments and blank lines. */
export function parseEnvFile(content: string): EnvMap {
  const result: EnvMap = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;

    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (key) result[key] = value;
  }
  return result;
}

/** Serialize a key/value map into KEY=value lines. */
export function serializeEnvFile(env: EnvMap): string {
  const entries = Object.entries(env);
  if (entries.length === 0) return "";
  return entries.map(([k, v]) => `${k}=${v}`).join("\n") + "\n";
}

/**
 * Merge new values into existing .env file content, preserving comments and order.
 * Existing keys are updated in place; new keys are appended.
 */
export function mergeEnv(existingContent: string, updates: EnvMap): string {
  if (Object.keys(updates).length === 0) return existingContent;

  const lines = existingContent.split("\n");
  const seen = new Set<string>();
  const outputLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      outputLines.push(line);
      continue;
    }
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) {
      outputLines.push(line);
      continue;
    }
    const key = trimmed.slice(0, eqIdx).trim();
    if (key in updates) {
      outputLines.push(`${key}=${updates[key]}`);
      seen.add(key);
    } else {
      outputLines.push(line);
    }
  }

  for (const [key, value] of Object.entries(updates)) {
    if (!seen.has(key)) {
      outputLines.push(`${key}=${value}`);
    }
  }

  return outputLines.join("\n");
}

/** Read a .env file. Returns empty string if the file does not exist. */
export function readEnvFile(path: string): string {
  if (!fs.existsSync(path)) return "";
  return fs.readFileSync(path, "utf8");
}

/** Write content to a .env file. */
export function writeEnvFile(path: string, content: string): void {
  fs.writeFileSync(path, content, "utf8");
}
