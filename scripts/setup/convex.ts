import { spawnSync } from "node:child_process";

/** Run `npx convex env list` and return the set of defined variable names. */
export function listConvexEnv(): Set<string> {
  const result = spawnSync("npx", ["convex", "env", "list"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.status !== 0) {
    throw new Error(
      `npx convex env list failed (exit ${result.status}): ${result.stderr || "no stderr"}`,
    );
  }

  const names = new Set<string>();
  for (const line of result.stdout.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const eqIdx = trimmed.indexOf("=");
    const key = eqIdx === -1 ? trimmed : trimmed.slice(0, eqIdx).trim();
    if (key && /^[A-Z_][A-Z0-9_]*$/.test(key)) {
      names.add(key);
    }
  }
  return names;
}

/** Set a single Convex environment variable. Throws on failure. */
export function setConvexEnv(key: string, value: string): void {
  const result = spawnSync("npx", ["convex", "env", "set", key, value], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.status !== 0) {
    throw new Error(
      `npx convex env set ${key} failed (exit ${result.status}): ${result.stderr || "no stderr"}`,
    );
  }
}

/**
 * Run `npx convex dev --once` with inherited stdio so the user sees the
 * Convex CLI prompts and can log in / pick a project.
 */
export function runConvexDevOnce(): void {
  const result = spawnSync("npx", ["convex", "dev", "--once"], {
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error(
      `npx convex dev --once failed (exit ${result.status}). ` +
        "Make sure you are logged in (npx convex login) and try again.",
    );
  }
}
